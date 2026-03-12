import WebSocket from 'ws';
import { GoogleAuth } from 'google-auth-library';
import 'dotenv/config';

const GCP_PROJECT_ID = 'rekvin-v0';
const GCP_LOCATION = 'us-central1';
const LIVE_MODEL = 'gemini-live-2.5-flash-native-audio';

// Vertex AI endpoint
const LIVE_WS_URL = `wss://${GCP_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function run() {
    console.log('Getting access token...');
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = token.token;

    console.log('Connecting to Vertex AI WebSocket...');
    const geminiWs = new WebSocket(LIVE_WS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    geminiWs.on('open', () => {
        console.log('WebSocket connected. Sending configMessage...');
        
        const configMessage = {
            setup: {
                model: `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${LIVE_MODEL}`,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Puck'
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: `You are testing.` }]
                }
            }
        };

        geminiWs.send(JSON.stringify(configMessage));
    });

    geminiWs.on('message', (data) => {
        const response = JSON.parse(data.toString());
        console.log('Received message type(s):', Object.keys(response));
        
        if (response.setupComplete) {
            console.log('Setup complete. Sending initial message...');
            const initialMessage = {
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: 'Hello, please say something to test the audio.' }]
                    }],
                    turnComplete: true
                }
            };
            geminiWs.send(JSON.stringify(initialMessage));
            return;
        }

        if (response.serverContent) {
            console.log('serverContent keys:', Object.keys(response.serverContent));
            const sc = response.serverContent;
            if (sc.modelTurn) {
                console.log('modelTurn keys:', Object.keys(sc.modelTurn));
                if (sc.modelTurn.parts) {
                    sc.modelTurn.parts.forEach((p: any, i: number) => {
                        console.log(`Part ${i} keys:`, Object.keys(p));
                        if (p.inlineData) console.log(`Part ${i} has inlineData`);
                        if (p.inline_data) console.log(`Part ${i} has inline_data (SNAKE_CASE!)`);
                    });
                }
            }
            if (sc.outputTranscription) {
                console.log('outputTranscription present');
            }
            if (sc.output_transcription) {
                console.log('output_transcription present (SNAKE_CASE!)');
            }
        }
        
        // Also check root for snake_case
        if (response.server_content) {
            console.log('server_content present (SNAKE_CASE!)');
        }
    });

    geminiWs.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });

    geminiWs.on('close', (code, reason) => {
        console.log('WebSocket closed. Code:', code, 'Reason:', reason.toString());
    });
}

run().catch(console.error);
