import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Hello",
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        personaFit: {
                            type: Type.OBJECT,
                            properties: {
                                score: { type: Type.STRING },
                                assessment: { type: Type.STRING }
                            }
                        },
                        productFixes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    priority: { type: Type.STRING },
                                    issue: { type: Type.STRING },
                                    recommendation: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log(response.text);
    } catch (e) {
        console.error(e);
    }
}
run();
