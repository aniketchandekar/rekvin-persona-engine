import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type Page } from 'playwright';
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleAuth } from 'google-auth-library';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const GCP_PROJECT_ID = 'rekvin-v0';
const GCP_LOCATION = 'us-central1';
const LIVE_MODEL = 'gemini-live-2.5-flash-native-audio';

// Server-side Gemini proxy for the frontend
// Uses google-auth-library (ADC) + direct Vertex AI REST API
// This avoids @google/genai ESM module import issues on Cloud Run
app.post('/api/gemini/proxy', async (req, res) => {
    const { model: modelName, contents, config } = req.body;
    const model = modelName || 'gemini-2.0-flash';
    try {
        const accessToken = await getAccessToken();
        const endpoint = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${model}:generateContent`;

        let formattedContents = contents;
        if (typeof contents === 'string') {
            formattedContents = [{ role: 'user', parts: [{ text: contents }] }];
        } else if (Array.isArray(contents)) {
            if (contents.length > 0 && !contents[0].role) {
                formattedContents = [{ role: 'user', parts: contents }];
            }
        } else if (typeof contents === 'object' && contents !== null) {
            if (contents.parts) {
                formattedContents = [{ role: 'user', parts: contents.parts }];
            } else {
                formattedContents = [{ role: 'user', parts: [contents] }];
            }
        }

        const body: any = { contents: formattedContents };
        if (config?.responseMimeType || config?.responseSchema) {
            body.generationConfig = {};
            if (config.responseMimeType) body.generationConfig.responseMimeType = config.responseMimeType;
            if (config.responseSchema) body.generationConfig.responseSchema = config.responseSchema;
        }
        if (config?.systemInstruction) {
            body.systemInstruction = config.systemInstruction;
        }
        if (config?.tools) {
            body.tools = config.tools;
        }

        const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.error('Vertex AI proxy error response:', errText);
            return res.status(apiRes.status).json({ error: errText });
        }

        const data: any = await apiRes.json();
        // Extract text from first candidate
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        res.json({ text, raw: data });
    } catch (err: any) {
        console.error('Gemini proxy error:', err);
        res.status(500).json({ error: err?.message || 'Gemini proxy error' });
    }
});

// API routes should come BEFORE static serving

// Use Vertex AI endpoint for the Multimodal Live API (GA model: gemini-live-2.5-flash-native-audio)
const LIVE_WS_URL = `wss://${GCP_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function getAccessToken() {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

// ── SSE client registry ──────────────────────────────────────────────
const sseClients = new Map<string, express.Response>();

// ── Active browser sessions ──────────────────────────────────────────
interface AgentSession {
    browser: Browser;
    page: Page;
    running: boolean;
    micActive?: boolean;
    geminiWs?: WebSocket;
    sessionLog: string[];
    playwright?: {
        screenshotInterval: ReturnType<typeof setInterval> | null;
    };
}
const activeSessions = new Map<string, AgentSession>();

// ══════════════════════════════════════════════════════════════════════
//  TOOL DEFINITIONS for Gemini Live API
// ══════════════════════════════════════════════════════════════════════

const BROWSER_TOOLS = [
    {
        functionDeclarations: [
            {
                name: 'click_element',
                description: 'Click on a UI element identified by its CSS selector, aria-label, text content, or role. Use selectors like #id, [aria-label="..."], button:has-text("..."), or a:has-text("...").',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        selector: {
                            type: 'STRING',
                            description: 'CSS selector or Playwright locator string for the element to click.'
                        },
                        thought: {
                            type: 'STRING',
                            description: 'Brief first-person narration as the persona explaining WHY you are clicking this.'
                        }
                    },
                    required: ['selector', 'thought']
                }
            },
            {
                name: 'type_text',
                description: 'Type text into an input field identified by its CSS selector.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        selector: {
                            type: 'STRING',
                            description: 'CSS selector for the input field.'
                        },
                        value: {
                            type: 'STRING',
                            description: 'The text to type into the field.'
                        },
                        thought: {
                            type: 'STRING',
                            description: 'Brief first-person narration as the persona explaining what you are typing and why.'
                        }
                    },
                    required: ['selector', 'value', 'thought']
                }
            },
            {
                name: 'scroll_page',
                description: 'Scroll the page down to see more content.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        thought: {
                            type: 'STRING',
                            description: 'Brief narration explaining why you need to scroll.'
                        }
                    },
                    required: ['thought']
                }
            },
            {
                name: 'hover_element',
                description: 'Hover over a UI element to trigger tooltips or menus.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        selector: {
                            type: 'STRING',
                            description: 'CSS selector for the element to hover.'
                        },
                        thought: {
                            type: 'STRING',
                            description: 'Brief narration explaining why you are hovering.'
                        }
                    },
                    required: ['selector', 'thought']
                }
            },
            {
                name: 'finish_session',
                description: 'Call this when you believe you have completed the task OR when you want to abandon the session due to frustration.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        reason: {
                            type: 'STRING',
                            description: 'Why the session is ending (completed, frustrated, stuck, etc.).'
                        },
                        summary: {
                            type: 'STRING',
                            description: 'A 2-3 sentence summary of your overall experience on this website as the persona.'
                        }
                    },
                    required: ['reason', 'summary']
                }
            }
        ]
    }
];

// ══════════════════════════════════════════════════════════════════════
//  ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// 1. SSE stream
app.get('/api/test/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.set(sessionId, res);
    req.on('close', () => {
        sseClients.delete(sessionId);
        const session = activeSessions.get(sessionId);
        if (session) session.running = false;
    });
});

// 2. Start a test
app.post('/api/test/start', async (req, res) => {
    const { sessionId, targetUrl, persona, goal } = req.body;
    if (!sessionId || !targetUrl || !persona) {
        return res.status(400).json({ error: 'Missing sessionId, targetUrl, or persona' });
    }
    res.json({ status: 'started', sessionId });
    runLiveAgentLoop(sessionId, targetUrl, persona, goal).catch(err => {
        console.error(`[${sessionId}] Fatal agent error:`, err);
        sendEvent(sessionId, 'error', { message: err?.message || 'Unknown fatal error' });
    });
});

// 3. Stop a test
app.post('/api/test/stop', (req, res) => {
    const { sessionId } = req.body;
    const session = activeSessions.get(sessionId);
    if (session) {
        session.running = false;
        if (session.geminiWs) {
            session.geminiWs.close();
        }
        res.json({ status: 'stopping' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// 4. Receive user microphone audio
app.post('/api/test/audio', (req, res) => {
    const { sessionId, audioData } = req.body;
    const session = activeSessions.get(sessionId);
    if (!session || !session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) {
        return res.status(404).json({ error: 'No active Live API session' });
    }

    // Forward user audio to Gemini Live API
    const audioMessage = {
        realtimeInput: {
            audio: {
                data: audioData, // base64 PCM 16kHz
                mimeType: 'audio/pcm;rate=16000'
            }
        }
    };
    session.geminiWs.send(JSON.stringify(audioMessage));
    res.json({ ok: true });
});

// 5. Toggle microphone state (conversation mode vs. testing mode)
app.post('/api/test/mic-state', (req, res) => {
    const { sessionId, active } = req.body;
    const session = activeSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.micActive = active;
    console.log(`[${sessionId}] Mic state changed to: ${active ? 'ACTIVE (Conversation Mode)' : 'INACTIVE (Testing Mode)'}`);

    if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
        let msg = "";
        if (active) {
            const history = session.sessionLog.length > 0 
                ? session.sessionLog.join('\n')
                : "No actions taken yet.";
                
            msg = `[SYSTEM] User has turned on their microphone. Suspend all autonomous testing actions and tools.
Switch to CONVERSATION MODE: listen to the user, respond to their questions in character, and wait for their input. 
Do not click or type anything until the mic is turned off.

SESSION LOG SO FAR:
${history}

Use this log to answer questions about what you have done, what failed, or what you observe.`;
        } else {
            msg = "[SYSTEM] User has turned off their microphone. Switch back to TESTING MODE: resume autonomous testing and navigation of the application using your tools. Follow the previous goal if provided.";
        }
            
        session.geminiWs.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text: msg }]
                }],
                turnComplete: true
            }
        }));
    }

    res.json({ success: true });
});

// 6. Text-to-Speech endpoint (used by PersonaChatModal)
app.post('/api/tts', async (req, res) => {
    const { text, voiceName, prompt } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const accessToken = await getAccessToken();
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`;
        
        // 30 Gemini Voices
        const GEMINI_VOICES = [
            'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 
            'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 
            'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Pulcherrima', 
            'Puck', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 
            'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'
        ];
        
        const selectedVoice = GEMINI_VOICES.includes(voiceName) ? voiceName : 'Puck';

        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'x-goog-user-project': GCP_PROJECT_ID
            },
            body: JSON.stringify({
                input: { 
                    text,
                    prompt: prompt || undefined
                },
                voice: { 
                    languageCode: 'en-US', 
                    name: selectedVoice,
                    model_name: 'gemini-2.5-flash-tts'
                },
                audioConfig: { 
                    audioEncoding: 'MP3'
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('TTS error:', err);
            return res.status(response.status).json({ error: 'Failed to synthesize speech' });
        }

        const data: any = await response.json();
        res.json({ audioBase64: data.audioContent });
    } catch (err: any) {
        console.error('TTS endpoint error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ══════════════════════════════════════════════════════════════════════
//  SSE HELPERS
// ══════════════════════════════════════════════════════════════════════

function sendEvent(sessionId: string, event: string, data: object) {
    const client = sseClients.get(sessionId);
    if (client) {
        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// ══════════════════════════════════════════════════════════════════════
//  PERSONA PROMPT BUILDER
// ══════════════════════════════════════════════════════════════════════

function buildPersonaPrompt(persona: any): string {
    let prompt = `Name: "${persona.label}".\nDescription: ${persona.content || persona.description || 'A general user.'}`;

    if (persona.fields && Object.keys(persona.fields).length > 0) {
        prompt += '\n\nKey Behavioral Traits:';
        for (const [key, value] of Object.entries(persona.fields)) {
            prompt += `\n- ${key}: ${value}`;
        }
    }

    return prompt;
}

// ══════════════════════════════════════════════════════════════════════
//  CORE LIVE AGENT LOOP
// ══════════════════════════════════════════════════════════════════════

async function runLiveAgentLoop(sessionId: string, targetUrl: string, persona: any, goal?: string) {
    // ── 1. LAUNCH BROWSER ────────────────────────────────────────────
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Handle dialogs (alerts, confirms, prompts) automatically
    page.on('dialog', async dialog => {
        console.log(`[${sessionId}] Browser dialog detected (${dialog.type()}): "${dialog.message()}". Automatically accepting.`);
        session.sessionLog.push(`[System] Automatically accepted ${dialog.type()} dialog: "${dialog.message()}"`);
        await dialog.accept().catch(() => {});
    });

    const session: AgentSession = { 
        browser, 
        page, 
        running: true, 
        micActive: false, 
        geminiWs: undefined, 
        sessionLog: [],
        playwright: { screenshotInterval: null } 
    };
    activeSessions.set(sessionId, session);

    const personaPrompt = buildPersonaPrompt(persona);
    let stepCount = 0;
    const MAX_STEPS = 20;

    sendEvent(sessionId, 'status', {
        status: 'running',
        message: `Initializing Live API session for "${persona.label}"...`,
    });

    try {
        // ── 2. NAVIGATE TO TARGET ────────────────────────────────────────
        // Use networkidle for modern SPAs to ensure all initial requests complete
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.waitForTimeout(2000);

        sendEvent(sessionId, 'status', {
            status: 'running',
            message: `Page loaded. Connecting to Vertex AI Live API...`,
        });

        // ── 3. OPEN VERTEX AI LIVE API WEBSOCKET ─────────────────────────
        const accessToken = await getAccessToken();
        const geminiWs = new WebSocket(LIVE_WS_URL, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        session.geminiWs = geminiWs;

        await new Promise<void>((resolve, reject) => {
            geminiWs.on('open', () => {
                console.log(`[${sessionId}] Gemini Live API WebSocket connected`);

                // Send initial configuration
                // Use the Vertex AI model format
                const configMessage = {
                    setup: {
                        model: `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${LIVE_MODEL}`,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: persona.voiceName || persona.voice_name || 'Puck'
                                    }
                                }
                            }
                        },
                        contextWindowCompression: {
                            triggerTokens: 25600,
                            slidingWindow: { targetTokens: 12800 }
                        },
                        systemInstruction: {
                            parts: [{
                                text: `You are role-playing as a specific user persona who is testing a web application.
You must stay FULLY in character. Your narrations, hesitations, and frustrations must reflect the persona's traits.

YOUR PERSONA:
${personaPrompt}
${goal ? `\nYOUR CURRENT GOAL:\n"${goal}"\nYou must try to accomplish this goal while staying in character.` : ''}

RULES:
- You SEE the web application through the video frames being streamed to you.
- CRITICAL: Only interact with elements you VISIBLY see on the screen. Describe the actual text labels you see before acting.
- DO NOT assume standard links like "Products", "Pricing", or "About" exist if they are not clearly labeled.
- You ACT on the app by calling the provided browser tools.
- Narrate your thoughts out loud in first person as the persona before each action.
- If a tool fails (e.g. timeout), DO NOT simply retry the same action. Observe the page again to see if the element exists or if the page state changed.
- If the persona has low tech literacy, hesitate and express confusion at complex UI.
- If the persona has low patience, abandon after 2-3 frustrations.
- For selectors, prefer #id, [aria-label="..."], or button:has-text("Text") formats.
- DO NOT use jQuery pseudo-classes like :contains(). Use :has-text("...") instead.
- When the user speaks to you during the session, they are the UX researcher observing you. Respond in character and adjust your behavior based on their instructions.
- After approximately ${MAX_STEPS} actions, wrap up and call finish_session.
- You have access to a [SESSION LOG] which records your actions. Refer to it if the user asks "What did you just do?" or similar questions.
- Begin by observing the page and narrating your first impressions, then take your first action.`
                            }]
                        },
                        tools: BROWSER_TOOLS,
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                    }
                };

                geminiWs.send(JSON.stringify(configMessage));
                resolve();
            });

            geminiWs.on('error', (err) => {
                console.error(`[${sessionId}] Gemini Live API WebSocket error:`, err);
                reject(err);
            });

            // Timeout after 10s
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
        });

        sendEvent(sessionId, 'status', {
            status: 'running',
            message: `Live API connected. Agent is observing the page...`,
        });

        // ── 4. HANDLE INCOMING MESSAGES FROM GEMINI ──────────────────────
        geminiWs.on('message', async (rawData) => {
            if (!session.running) return;

            try {
                const response = JSON.parse(rawData.toString());

                if (response.error) {
                    console.error(`[${sessionId}] Vertex AI WS Error received:`, JSON.stringify(response.error, null, 2));
                }

                // ── Setup complete acknowledgment ──
                if (response.setupComplete) {
                    console.log(`[${sessionId}] Live API setup complete`);
                    // Send the first screenshot to kick things off
                    await sendScreenshotToGemini(session, sessionId);
                    
                    // Send an initial message to trigger the model to start acting
                    const initialMessage = {
                        clientContent: {
                            turns: [{
                                role: 'user',
                                parts: [{ text: 'The page has loaded. Please begin your testing session now.' }]
                            }],
                            turnComplete: true
                        }
                    };
                    session.geminiWs?.send(JSON.stringify(initialMessage));

                    // Start periodic screenshot streaming
                    session.playwright!.screenshotInterval = setInterval(async () => {
                        if (session.running) {
                            await sendScreenshotToGemini(session, sessionId);
                        }
                    }, 3000);
                    return;
                }

                // ── Server content (audio, text, transcriptions) ──
                if (response.serverContent || response.server_content) {
                    const sc = response.serverContent || response.server_content;

                    // Audio output from Gemini
                    const modelTurn = sc.modelTurn || sc.model_turn;
                    if (modelTurn?.parts) {
                        for (const part of modelTurn.parts) {
                            const inlineData = part.inlineData || part.inline_data;
                            if (inlineData) {
                                // Raw PCM audio from Gemini — send raw base64 to client for seamless AudioContext playback
                                sendEvent(sessionId, 'audio', {
                                    step: stepCount,
                                    audioBase64: inlineData.data,
                                    sampleRate: 24000  // Gemini outputs 24kHz PCM 16-bit mono
                                });
                            }
                            // NOTE: part.text is NOT emitted as a thought here.
                            // In AUDIO mode, the spoken content arrives via outputTranscription,
                            // so emitting part.text would create duplicate/redundant transcript entries.
                        }
                    }

                    // Input transcription (user's voice)
                    const inputTranscription = sc.inputTranscription || sc.input_transcription;
                    if (inputTranscription?.text) {
                        sendEvent(sessionId, 'user_transcript', {
                            text: inputTranscription.text,
                            timestamp: Date.now()
                        });
                    }

                    // Output transcription (agent's voice)
                    const outputTranscription = sc.outputTranscription || sc.output_transcription;
                    if (outputTranscription?.text) {
                        sendEvent(sessionId, 'agent_transcript', {
                            text: outputTranscription.text,
                            timestamp: Date.now()
                        });
                    }
                }

                // ── Tool calls from Gemini ──
                if (response.toolCall) {
                    if (session.micActive) {
                        console.log(`[${sessionId}] Tool call received but suppressed due to active microphone (Conversation Mode)`);
                        return;
                    }

                    const functionCalls = response.toolCall.functionCalls || [];
                    const functionResponses: any[] = [];

                    for (const fc of functionCalls) {
                        stepCount++;

                        // Emit a clean thought for this action (persona narration only)
                        const actionName = fc.name.replace('_element', '').replace('_text', '').replace('_page', '').replace('_session', '');
                        sendEvent(sessionId, 'thought', {
                            step: stepCount - 1,
                            thought: fc.args?.thought || 'Taking action...',
                            action: actionName,
                            selector: fc.args?.selector || null,
                            value: fc.args?.value || null,
                            reason: fc.args?.reason || null,
                            timestamp: Date.now()
                        });

                        // Execute the tool
                        const result = await executeTool(page, fc.name, fc.args || {});

                        sendEvent(sessionId, 'action_result', {
                            step: stepCount - 1,
                            success: result.success,
                            detail: result.detail
                        });

                        functionResponses.push({
                            name: fc.name,
                            id: fc.id,
                            response: { result: result }
                        });

                        // Update session log
                        session.sessionLog.push(`[Action] ${actionName}: ${result.success ? 'Success' : 'Failed'} - ${result.detail}`);
                        if (fc.args?.thought) {
                            session.sessionLog.push(`[Thought] ${fc.args.thought}`);
                        }

                        // Check if session should end
                        if (fc.name === 'finish_session' || stepCount >= MAX_STEPS) {
                            session.running = false;

                            sendEvent(sessionId, 'status', {
                                status: 'completed',
                                message: fc.args?.summary || 'Session ended.',
                                reason: fc.args?.reason || (stepCount >= MAX_STEPS ? 'max_steps' : 'completed'),
                                step: stepCount,
                            });

                            // Generate analysis
                            await generateAnalysis(sessionId, persona, stepCount);
                        }
                    }

                    // Send tool responses back to Gemini IMMEDIATELY to unblock the model
                    if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
                        const toolResponseMessage = {
                            toolResponse: {
                                functionResponses: functionResponses
                            }
                        };
                        session.geminiWs.send(JSON.stringify(toolResponseMessage));
                    }

                    // THEN wait briefly and send a follow-up screenshot (non-blocking for the model)
                    if (session.running) {
                        await page.waitForTimeout(500);
                        await sendScreenshotToGemini(session, sessionId);
                    }
                }

            } catch (err: any) {
                console.error(`[${sessionId}] Error processing Gemini message:`, err?.message);
            }
        });

        geminiWs.on('close', (code, reason) => {
            console.log(`[${sessionId}] Gemini Live API WebSocket closed. Code: ${code}`);
            if (session.running) {
                session.running = false;
                sendEvent(sessionId, 'status', { status: 'completed', message: 'Live API session ended.' });
            }
        });

        geminiWs.on('error', (err) => {
            console.error(`[${sessionId}] Gemini WS error:`, err);
            sendEvent(sessionId, 'error', { message: `Live API error: ${err.message}` });
        });

        // Keep the loop alive until the session ends
        await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
                if (!session.running) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });

    } catch (err: any) {
        sendEvent(sessionId, 'error', { message: err?.message || 'Agent encountered an unknown error.' });
    } finally {
        // Cleanup
        if (session.playwright?.screenshotInterval) clearInterval(session.playwright.screenshotInterval);
        if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
            session.geminiWs.close();
        }
        await browser.close();
        activeSessions.delete(sessionId);
        sendEvent(sessionId, 'status', { status: 'done', message: 'Session finished.' });
    }
}

// ══════════════════════════════════════════════════════════════════════
//  SCREENSHOT STREAMING
// ══════════════════════════════════════════════════════════════════════

async function sendScreenshotToGemini(session: AgentSession, sessionId: string) {
    if (!session.running || !session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) return;

    try {
        const screenshotBuf = await session.page.screenshot({ type: 'jpeg', quality: 90 });
        const base64Screenshot = screenshotBuf.toString('base64');

        // Send to frontend for display
        sendEvent(sessionId, 'screenshot', {
            step: 0,
            url: session.page.url(),
            image: base64Screenshot
        });

        // Send to Gemini Live API as video frame
        const videoMessage = {
            realtimeInput: {
                video: {
                    data: base64Screenshot,
                    mimeType: 'image/jpeg'
                }
            }
        };
        session.geminiWs.send(JSON.stringify(videoMessage));
    } catch (err: any) {
        console.error(`[${sessionId}] Screenshot error:`, err?.message);
    }
}

// ══════════════════════════════════════════════════════════════════════
//  TOOL EXECUTOR
// ══════════════════════════════════════════════════════════════════════

async function executeTool(page: Page, toolName: string, args: any): Promise<{ success: boolean; detail: string }> {
    const timeout = 6000; // Increased timeout for better stability

    // ── Pre-process selector ──────────────────────────────────────────
    let selector = args.selector;
    if (selector && typeof selector === 'string') {
        // Auto-fix common LLM hallucinated selectors
        selector = selector.replace(/:contains\((.*?)\)/g, ':has-text($1)');
    }

    try {
        // ── Handle finish_session separately ──────────────────────────
        if (toolName === 'finish_session') {
            return { success: true, detail: `Session finished: ${args.reason || 'completed'}` };
        }

        // ── Initialize Locator ────────────────────────────────────────
        // Support role-based locators if provided in role=type[name="Label"] format
        let locator;
        if (selector?.startsWith('role=')) {
            const roleMatch = selector.match(/role=(\w+)\[name="([^"]+)"\]/);
            if (roleMatch) {
                const [, role, name] = roleMatch;
                locator = page.getByRole(role as any, { name, exact: false });
            } else {
                locator = page.locator(selector);
            }
        } else if (selector) {
            locator = page.locator(selector);
        }

        // ── Execute Actions ───────────────────────────────────────────
        switch (toolName) {
            case 'click_element': {
                if (!locator) return { success: false, detail: 'No selector provided for click' };
                await locator.click({ timeout });
                return { success: true, detail: `Clicked "${selector}"` };
            }

            case 'type_text': {
                if (!locator || !args.value) return { success: false, detail: 'Missing selector or value for type' };
                // fill() is safer as it clears existing value and waits for visibility/editability
                await locator.fill(args.value, { timeout });
                return { success: true, detail: `Typed into "${selector}"` };
            }

            case 'scroll_page': {
                // Better than just PageDown: scroll until the next batch of content is likely in view
                await page.keyboard.press('PageDown');
                await page.waitForTimeout(500); // Allow brief settling
                return { success: true, detail: 'Scrolled down one page' };
            }

            case 'hover_element': {
                if (!locator) return { success: false, detail: 'No selector for hover' };
                await locator.hover({ timeout });
                return { success: true, detail: `Hovered over "${selector}"` };
            }

            default:
                return { success: false, detail: `Unknown tool: "${toolName}"` };
        }
    } catch (err: any) {
        // Provide granular feedback for specific failure modes from Locator API
        const errMsg = err?.message || 'Unknown error';
        const isTimeout = errMsg.toLowerCase().includes('timeout');
        const isHidden = errMsg.toLowerCase().includes('not visible');
        
        let detail = `Tool "${toolName}" failed on "${selector}"`;
        if (isTimeout) detail += ': Timeout exceeded. Element might not exist or is taking too long to load.';
        else if (isHidden) detail += ': Element exists but is currently hidden or obscured.';
        else detail += `: ${errMsg.split('\n')[0].slice(0, 150)}`;
            
        return { success: false, detail };
    }
}

// ══════════════════════════════════════════════════════════════════════
//  SESSION ANALYSIS (uses standard API, not Live)
// ══════════════════════════════════════════════════════════════════════

async function generateAnalysis(sessionId: string, persona: any, totalSteps: number) {
    sendEvent(sessionId, 'status', { status: 'analyzing', message: 'Synthesizing session insights...' });

    try {
        const { GoogleGenAI } = await import('@google/genai');
        // Initialize GenAI for Vertex AI usage
        const ai = new (GoogleGenAI as any)({
            vertex: true,
            project: GCP_PROJECT_ID,
            location: GCP_LOCATION,
        });

        const prompt = `You are a UX research analyst.
An AI persona ("${persona.label}": ${persona.content || ''}) just autonomously navigated a web application for ${totalSteps} steps using Gemini Live API.

Provide a structured analysis as JSON:
{
  "story": "2-3 sentence narrative of the persona's overall experience.",
  "insights": ["3-5 specific, actionable UX insights"],
  "metrics": {
    "successScore": <0-100>,
    "frictionRating": <1-10>,
    "sentiment": "Positive | Neutral | Negative",
    "cognitiveLoad": "Low | Medium | High",
    "stepsCompleted": ${totalSteps},
    "abandonmentReason": "<string or null>"
  }
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
        });

        const analysis = JSON.parse(response.text || '{}');
        sendEvent(sessionId, 'analysis', analysis);
    } catch (err: any) {
        console.error(`[${sessionId}] Analysis error:`, err?.message);
        sendEvent(sessionId, 'analysis', {
            story: 'Analysis could not be completed.',
            insights: [],
            metrics: { successScore: 0, frictionRating: 0, sentiment: 'Unknown', cognitiveLoad: 'Unknown', stepsCompleted: totalSteps, abandonmentReason: null },
        });
    }
}

// ══════════════════════════════════════════════════════════════════════
//  WAV HEADER WRAPPER (24kHz 16-bit mono PCM → WAV)
// ══════════════════════════════════════════════════════════════════════

function wrapPcmInWav(pcmBase64: string): string {
    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const dataLength = pcmBuffer.length;
    const wavBuffer = Buffer.alloc(44 + dataLength);

    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36 + dataLength, 4);
    wavBuffer.write('WAVE', 8);

    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // Mono
    wavBuffer.writeUInt32LE(24000, 24); // 24kHz
    wavBuffer.writeUInt32LE(24000 * 2, 28); // Byte rate
    wavBuffer.writeUInt16LE(2, 32); // Block align
    wavBuffer.writeUInt16LE(16, 34); // 16-bit

    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataLength, 40);

    pcmBuffer.copy(wavBuffer, 44);

    return wavBuffer.toString('base64');
}

// ══════════════════════════════════════════════════════════════════════
//  START SERVER
// Serve built frontend files from the 'dist' directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Fallback for SPA routing - catch-all must be LAST
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// ── Startup ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`\n🤖 Rekvin engine running on port ${PORT}`);
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Project ID: ${GCP_PROJECT_ID}`);
    console.log(`   Vertex AI Model: ${LIVE_MODEL}\n`);
});

// ══════════════════════════════════════════════════════════════════════
//  VISION MODE WEBSOCKET (SCREEN RATING / LIVE API)
// ══════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws/vision')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws, req) => {
    console.log('[Vision Mode] Browser connected');
    let geminiWs: WebSocket | null = null;
    let isConnected = false;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'start') {
                const persona = data.persona;
                const personaPrompt = buildPersonaPrompt(persona);

                const accessToken = await getAccessToken();
                geminiWs = new WebSocket(LIVE_WS_URL, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                geminiWs.on('open', () => {
                    console.log('[Vision Mode] Connected to Vertex AI Live API');
                    isConnected = true;
                    const configMessage = {
                        setup: {
                            model: `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${LIVE_MODEL}`,
                            generationConfig: {
                                responseModalities: ['AUDIO'],
                                speechConfig: {
                                    voiceConfig: {
                                        prebuiltVoiceConfig: {
                                            voiceName: persona?.data?.voiceName || persona?.voiceName || persona?.data?.voice_name || persona?.voice_name || 'Puck'
                                        }
                                    }
                                }
                            },
                            contextWindowCompression: {
                                triggerTokens: 25600,
                                slidingWindow: { targetTokens: 12800 }
                            },
                            systemInstruction: {
                                parts: [{
                                    text: `You are role-playing as a user persona. You are seeing the user's screen through video frames. Narrate your thoughts and experience out loud as the persona.\n\nYOUR PERSONA:\n${personaPrompt}\n\nRULES:\n- Look at the screen and talk about what catches your eye, what you would click, and your overall friction.\n- Do NOT offer to interact for them. Just declare what you would do.`
                                }]
                            }
                        }
                    };
                    geminiWs?.send(JSON.stringify(configMessage));
                });

                geminiWs.on('message', (geminiMsg) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            const response = JSON.parse(geminiMsg.toString());
                            if (response.setupComplete) {
                                ws.send(JSON.stringify({ type: 'ready' }));
                            }
                            if (response.serverContent?.modelTurn?.parts) {
                                for (const part of response.serverContent.modelTurn.parts) {
                                    if (part.inlineData) {
                                        const wavBase64 = wrapPcmInWav(part.inlineData.data);
                                        ws.send(JSON.stringify({ type: 'audio', data: wavBase64 }));
                                    }
                                    if (part.text) {
                                        ws.send(JSON.stringify({ type: 'transcript', text: part.text }));
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[Vision Mode] Error parsing Gemini message', e);
                        }
                    }
                });

                geminiWs.on('close', () => console.log('[Vision Mode] Gemini connection closed'));
            }

            if (data.type === 'frame' && isConnected && geminiWs) {
                geminiWs.send(JSON.stringify({
                    realtimeInput: {
                        video: {
                            mimeType: "image/jpeg",
                            data: data.data
                        }
                    }
                }));
            }

            if (data.type === 'stop') {
                geminiWs?.close();
                ws.close();
            }

        } catch (err) {
            console.error('[Vision Mode] Message error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[Vision Mode] Browser disconnected');
        if (geminiWs) geminiWs.close();
    });
});
