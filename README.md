# Rekvin

Rekvin is an AI-powered UX research platform that transforms static personas into autonomous, multimodal agents. Build personas through Socratic interviews, chat with them using native TTS, and deploy them to test your web applications autonomously.
 
 ![Architecture Diagram](Architecture%20Diagram.png)
 
 ## ✨ Key Features

- **Visual Persona Builder:** Create deep user archetypes using a node-based canvas and AI-guided Socratic interviews.
- **Multimodal Live Agent:** Watch AI agents navigate your site in real-time using the **Vertex AI Gemini Multimodal Live API**. The agent "sees" the UI at 1fps and immediately begins testing autonomously.
- **Interactive Conversation Mode:** Redirect the agent's behavior or ask for its reasoning mid-session. Using your microphone, you can intervene and have a real-time voice conversation with the synthetic agent.
- **Post-Session Agent Chat:** Debrief with the persona after a test session using the "Talk to Agent" button. This mode provides the agent with full session context, allowing for intelligent post-test reflections.
- **Premium Gemini TTS:** All narrations and chat responses are powered by character-consistent **Gemini TTS** voices with descriptions used as style prompts for high-fidelity audio.
- **Gender-Aware Voice Assignment:** Rekvin automatically detects the persona's gender from their name and description, assigning a corresponding male or female voice during creation.
- **Visual Metrics Hub:** Drag-and-drop analysis. Connect "Session" nodes to "Metric" nodes to calculate quantitative friction, comprehension risks, and completion rates.
- **Persona Calibration:** Every persona is assigned an AI-generated **Quality Score** based on the depth and diversity of its supporting evidence (Research, Assumptions, Ideas).
- **Automated UX Reports:** Generate structured diagnostic reports that calculate persona-fit and identify specific UI bottlenecks with automated verdicts.
- **Hybrid Audio Reliability:** A custom dual-path audio system. It prefers the low-latency raw PCM stream from Vertex AI during live sessions, but uses a robust **Gemini TTS queueing system** for thoughts, post-session debriefs, and reliability fallbacks.

## 🚀 Getting Started

**Prerequisites:** Node.js (v18+)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file in the root. The app uses **Google Cloud ADC** for the Live API (no key required), but uses an API key for REST analytics:
   ```env
   GEMINI_API_KEY=your_api_key_here
   GCP_PROJECT_ID=your_project_id
   GCP_LOCATION=us-central1
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

- **AI Framework:** Google Cloud Vertex AI (Live API: `gemini-live-2.5-flash-native-audio` [GA], Analytics: `gemini-2.5-pro` & `gemini-2.5-flash`)
- **Backend Architecture:** Secure Node.js proxy server relaying frontend AI calls to Vertex AI via ADC (`google-auth-library`), preventing API key exposure for live interactions.
- **Frontend:** React 19, Vite, Tailwind CSS (v4), Motion
- **Visuals:** `@xyflow/react` (React Flow)
- **Automation:** Playwright
