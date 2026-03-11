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
        console.log('Received message:', data.toString());
    });

    geminiWs.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });

    geminiWs.on('close', (code, reason) => {
        console.log('WebSocket closed. Code:', code, 'Reason:', reason.toString());
    });
}

run().catch(console.error);
