export const geminiService = {
  // Helper to call the backend proxy
  async _proxyCall(model: string, contents: any, config: any = {}) {
    const res = await fetch('/api/gemini/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, contents, config })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gemini proxy error');
    }
    const data = await res.json();
    return data;
  },

  // 1. Conversational voice apps (Live API)
  // This will be handled in a React component since it requires Web Audio API and WebSocket state management.

  // 2. Google Search data
  async searchGrounding(query: string) {
    const data = await this._proxyCall('gemini-2.5-flash-native-audio-preview-12-2025', query, {
      tools: [{ googleSearch: {} }],
    });
    return {
      text: data.text,
      chunks: [], // Grounding chunks are harder to proxy in one go, but text is enough for now
    };
  },

  // 3. Gemini intelligence (Pro for complex tasks)
  async complexTask(prompt: string) {
    const data = await this._proxyCall('gemini-2.5-pro', prompt);
    return data.text;
  },

  // 4. AI powered chatbot
  createChatbot(
    systemInstruction = 'You are a helpful assistant for building personas.',
    model = 'gemini-2.5-pro'
  ) {
    // For simple chat sessions in the frontend without complex history management,
    // we'll use a simplified version that calls the proxy.
    let history: any[] = [{ role: 'user', parts: [{ text: systemInstruction }] }, { role: 'model', parts: [{ text: "Understood." }] }];

    return {
      sendMessage: async ({ message }: { message: string }) => {
        history.push({ role: 'user', parts: [{ text: message }] });
        const data = await geminiService._proxyCall(model, history);
        history.push({ role: 'model', parts: [{ text: data.text }] });
        return { text: data.text };
      }
    };
  },

  // 5. Analyze images
  async analyzeImage(base64Image: string, mimeType: string, prompt: string) {
    const data = await this._proxyCall('gemini-2.5-pro', {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    });
    return data.text;
  },

  async analyzeDocument(base64Data: string, mimeType: string, prompt: string) {
    const data = await this._proxyCall('gemini-2.5-pro', {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    });
    return data.text;
  },

  // 6. Fast AI responses
  async fastResponse(prompt: string) {
    const data = await this._proxyCall('gemini-2.5-flash', prompt);
    return data.text;
  },

  async generateInterviewTurn(prompt: string) {
    const data = await this._proxyCall('gemini-2.5-pro', `Context: We are building a user persona through a Socratic interview.
      ${prompt}
      
      Ask the next logical question to uncover their assumptions, context, or user behaviors. Keep it brief (1-2 sentences).
      Also provide 3-4 likely or interesting short options the user could select as their answer.
      Return ONLY a JSON object with this schema:
      {
        "question": "The question text",
        "options": ["Option 1", "Option 2", "Option 3"]
      }`, {
      responseMimeType: 'application/json',
    });
    return data.text;
  },

  async generateFields(nodeType: string, content: string) {
    const data = await this._proxyCall('gemini-2.5-flash', `Analyze this ${nodeType} node content: "${content}". Generate 3 short key-value pairs (max 2 words per value) representing metadata/stats for this node. Return ONLY a JSON object.`, {
      responseMimeType: 'application/json',
    });
    return data.text;
  },

  // 7. Video understanding
  async analyzeVideo(prompt: string, base64Video: string, mimeType: string) {
    const data = await this._proxyCall('gemini-2.5-pro', {
      parts: [
        {
          inlineData: {
            data: base64Video,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    });
    return data.text;
  },

  // 8. Generate speech
  async generateSpeech(text: string) {
    // This modality is more complex to proxy. For now, we'll focus on the core chat features.
    // PersonaChatModal already has its own logic for fetching TTS.
    return null;
  },

  // 9. Think more when needed
  async thinkingTask(prompt: string) {
    const data = await this._proxyCall('gemini-2.5-pro', prompt, {
      thinkingConfig: { thinkingLevel: 'HIGH' },
    });
    return data.text;
  },

  // 10. Run Workflow Node
  async runWorkflowNode(targetNodeType: string, targetNodeLabel: string, previousNodeData: string, currentTargetData: string = '') {
    const hasCurrentData = currentTargetData && currentTargetData.trim().length > 0 && currentTargetData !== 'Generating...';
    
    const prompt = `You are an AI assistant in a visual node editor. 
      The user is running a workflow. 
      The previous node's content is: "${previousNodeData}".
      Your task is to generate the content for the next node, which is a "${targetNodeType}" node labeled "${targetNodeLabel}".
      ${hasCurrentData ? `IMPORTANT: The user has already provided some initial content/direction for this node: "${currentTargetData}". You MUST incorporate this into your generation, refining or expanding on it rather than ignoring it.` : ''}
      If you need more real-world information to complete this, use the Google Search tool.
      Keep the generated content concise, insightful, and directly relevant to the previous node's context.`;

    const data = await this._proxyCall('gemini-2.5-pro', prompt, {
      tools: [{ googleSearch: {} }],
    });
    return data.text;
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

    const data = await this._proxyCall('gemini-2.5-flash', prompt, {
      responseMimeType: 'application/json',
    });
    return data.text;
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
      type: 'OBJECT',
      properties: {
        personaFit: {
          type: 'OBJECT',
          properties: {
            score: { type: 'STRING' },
            assessment: { type: 'STRING' }
          }
        },
        productFixes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              priority: { type: 'STRING' },
              issue: { type: 'STRING' },
              recommendation: { type: 'STRING' }
            }
          }
        }
      }
    }, 'gemini-2.5-flash');
  },

  async generateJSON(prompt: string, schema: any, modelStr: string = 'gemini-2.5-pro') {
    const data = await this._proxyCall(modelStr, prompt, {
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
    try {
      return JSON.parse(data.text || '{}');
    } catch (e) {
      console.error("Failed to parse Gemini JSON response", e);
      return {};
    }
  },

  async detectPersonaVoice(name: string, content: string): Promise<string> {
    const prompt = `Determine the gender of this persona based on their name: "${name}" and description: "${content}".
    Return ONLY a JSON object with this schema:
    {
      "gender": "male" | "female" | "neutral"
    }
    
    Be decisive. If it's ambiguous, return "neutral".`;

    try {
      const result = await this.generateJSON(prompt, {
        type: 'OBJECT',
        properties: {
          gender: { type: 'STRING', enum: ['male', 'female', 'neutral'] }
        }
      }, 'gemini-2.5-flash');

      const gender = result.gender || 'neutral';
      
      // Mapping to specific premium voices
      if (gender === 'female') return 'Aoede';
      if (gender === 'male') return 'Charon';
      return 'Puck';
    } catch (error) {
      console.error("Voice detection error:", error);
      return 'Puck';
    }
  }
};
