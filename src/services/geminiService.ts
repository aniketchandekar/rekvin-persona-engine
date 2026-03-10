import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiService = {
  // 1. Conversational voice apps (Live API)
  // This will be handled in a React component since it requires Web Audio API and WebSocket state management.

  // 2. Google Search data
  async searchGrounding(query: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return {
      text: response.text,
      chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    };
  },

  // 3. Gemini intelligence (Pro for complex tasks)
  async complexTask(prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });
    return response.text;
  },

  // 4. AI powered chatbot
  createChatbot(
    systemInstruction = 'You are a helpful assistant for building personas.',
    model = 'gemini-3.1-pro-preview'
  ) {
    return ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
      },
    });
  },

  // 5. Analyze images
  async analyzeImage(base64Image: string, mimeType: string, prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    });
    return response.text;
  },

  async analyzeDocument(base64Data: string, mimeType: string, prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    });
    return response.text;
  },

  // 6. Fast AI responses
  async fastResponse(prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    return response.text;
  },

  async generateInterviewTurn(prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Context: We are building a user persona through a Socratic interview.
      ${prompt}
      
      Ask the next logical question to uncover their assumptions, context, or user behaviors. Keep it brief (1-2 sentences).
      Also provide 3-4 likely or interesting short options the user could select as their answer.
      Return ONLY a JSON object with this schema:
      {
        "question": "The question text",
        "options": ["Option 1", "Option 2", "Option 3"]
      }`,
      config: {
        responseMimeType: 'application/json',
      }
    });
    return response.text;
  },

  async generateFields(nodeType: string, content: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Analyze this ${nodeType} node content: "${content}". Generate 3 short key-value pairs (max 2 words per value) representing metadata/stats for this node. Return ONLY a JSON object.`,
      config: {
        responseMimeType: 'application/json',
      }
    });
    return response.text;
  },

  // 7. Video understanding
  async analyzeVideo(prompt: string, base64Video: string, mimeType: string) {
    // Note: Direct video analysis with base64 is supported via generateContent for some models,
    // but for large videos, File API is preferred. Assuming small base64 for now or we can use a different approach.
    // For this hackathon scope, we'll assume the user provides a base64 string or we use a text prompt describing a video.
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Video,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    });
    return response.text;
  },

  // 8. Generate speech
  async generateSpeech(text: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  },

  // 9. Think more when needed
  async thinkingTask(prompt: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });
    return response.text;
  },

  // 10. Run Workflow Node
  async runWorkflowNode(targetNodeType: string, targetNodeLabel: string, previousNodeData: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `You are an AI assistant in a visual node editor. 
      The user is running a workflow. 
      The previous node's content is: "${previousNodeData}".
      Your task is to generate the content for the next node, which is a "${targetNodeType}" node labeled "${targetNodeLabel}".
      If you need more real-world information to complete this, use the Google Search tool.
      Keep the generated content concise, insightful, and directly relevant to the previous node's context.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  },

  async generateNodeInsights(nodeType: string, content: string, context: string): Promise<string> {
    const prompt = `You are an expert product strategist and UX researcher.
    Analyze this ${nodeType} node.
    Content: "${content}"
    Connected context: "${context}"
    
    Provide 3-4 deep, actionable insights. Format as a short markdown list (using - for bullets). Focus on blind spots, opportunities, or root causes depending on the node type. Keep it concise and highly analytical.`;
    return this.fastResponse(prompt);
  },

  async analyzeMetric(sessionData: any, metricType: string, metricLabel: string): Promise<string> {
    const prompt = `You are a UX research analyst.
    Analyze the following user session data to calculate/evaluate the "${metricLabel}" metric.
    
    Session Data: ${JSON.stringify(sessionData)}
    
    Return ONLY a JSON object with this schema:
    {
      "value": "The primary metric value (e.g., '0.88s', '85%', 'Fast', '3.5s total')",
      "details": "A brief technical explanation (1 sentence)",
      "verdict": "A concise expert analysis (1 sentence)"
    }
    
    Keep all text extremely concise. Value should be prominent. Details and Verdict should be 1 sentence each.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    return response.text;
  },

  async generateDiagnosticReport(sessionData: any[], metricResults: any[]): Promise<any> {
    const prompt = `You are an expert UX Researcher and Product Strategist.
    Analyze the following connected session data and the resulting metric evaluations to generate a diagnostic report.
    
    Session Data:
    ${JSON.stringify(sessionData, null, 2)}
    
    Metric Results:
    ${JSON.stringify(metricResults, null, 2)}
    
    Return ONLY a JSON object with this schema:
    {
      "personaFit": {
        "score": "A score out of 5 (e.g., '3/5')",
        "assessment": "A focused 2-3 sentence assessment. Analyze if the product friction encountered was due to the persona's inherent constraints (low patience, low cognitive load, specific vocab) or if it's a general usability flaw. Provide a verdict on whether this is the right persona to be testing with, or if they are an extreme edge-case."
      },
      "productFixes": [
        {
          "priority": "HIGH, MED, or LOW",
          "issue": "A concise 1-sentence description of the UX issue based on the metrics (e.g. 'Step 3 Form Abandonment', 'Vocabulary mismatch on Pricing')",
          "recommendation": "A highly specific, actionable UX fix (1-2 sentences)."
        }
      ]
    }`;

    return this.generateJSON(prompt, {
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
    }, 'gemini-3-flash-preview');
  },

  async generateJSON(prompt: string, schema: any, modelStr: string = 'gemini-3.1-pro-preview') {
    const response = await ai.models.generateContent({
      model: modelStr,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });
    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse Gemini JSON response", e);
      return {};
    }
  }
};
