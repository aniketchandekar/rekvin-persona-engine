

# Rekvin

Rekvin is an AI-powered UX research platform that transforms static personas into autonomous, multimodal agents. Build personas through Socratic interviews, chat with them using native TTS, and deploy them to test your web applications autonomously.

## ✨ Key Features

- **Visual Persona Builder:** Create deep user archetypes using a node-based canvas and AI-guided Socratic interviews.
- **Multimodal Live Agent:** Watch AI agents navigate your site in real-time using the **Gemini Multimodal Live API**. The agent "sees" the UI at 1fps and immediately begins testing autonomously upon session start.
- **User Voice Intervention:** Talk to the agent during a test! Use your microphone to redirect the agent's behavior or ask about its experience mid-session.
- **Visual Metrics Hub:** Drag-and-drop analysis. Connect "Session" nodes to "Metric" nodes to calculate quantitative friction, comprehension risks, and completion rates.
- **Persona Calibration:** Every persona is assigned an AI-generated **Quality Score** based on the depth and diversity of its supporting evidence (Research, Assumptions, Ideas).
- **Automated UX Reports:** Generate and **download** structured diagnostic reports that calculate persona-fit and identify specific UI bottlenecks with automated verdicts.
- **Gapless Audio:** Advanced Web Audio API scheduling with autoplay-aware initialization ensures the agent's voice is seamless, natural, and reliable across all browsers.

## 🚀 Getting Started

**Prerequisites:** Node.js (v18+)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file in the root and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

## ☁️ Deployment (Google Cloud Run)

The application is fully containerized and configured for Google Cloud Run using **Vertex AI** and Application Default Credentials (ADC).
1. Build the Docker image: `gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/rekvin-engine`
2. Deploy to Cloud Run: `gcloud run deploy rekvin-engine --image gcr.io/[YOUR_PROJECT_ID]/rekvin-engine --platform managed --allow-unauthenticated --session-affinity`

## 🛠 Tech Stack

- **AI Framework:** Google Cloud Vertex AI (Live API: `gemini-2.5-flash-native-audio-preview`, Analytics: `gemini-2.5-pro` & `gemini-2.5-flash`)
- **Backend Architecture:** Secure Node.js proxy server relaying frontend AI calls to Vertex AI via ADC (`google-auth-library`), preventing API key exposure.
- **Frontend:** React 19, Vite, Tailwind CSS (v4), Motion
- **Visuals:** `@xyflow/react` (React Flow)
- **Automation:** Playwright
