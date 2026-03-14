# About Rekvin

Rekvin is an AI-powered UX research and autonomous testing platform. It allows product teams to build user archetypes (personas) through a visual node-based workflow and then deploy those personas as autonomous agents to test real-world web applications.

![Architecture Diagram](Architecture%20Diagram.png)

## 🚀 How it Uses Gen AI (Gemini SDK)

This project is built from the ground up to showcase the multimodal, reasoning, and synthesis capabilities of the Google Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, and the `gemini-2.5-flash-native-audio-preview` Live API).

### 1. Multimodal Live Agent (`gemini-live-2.5-flash-native-audio` [GA])
The core of the testing engine is a Playwright-driven agent loop powered by the **Vertex AI Multimodal Live API**.
- **1FPS Real-Time Vision:** Instead of static polling, the agent streams the browser's viewport at 1 frame per second. Gemini "sees" the UI continuously to understand animations, state changes, and interactive flow.
- **Autonomous Initialization:** The agent immediately begins its testing session upon page load, narrating its first impressions and taking actions without requiring initial user input.
- **Cognitive Context Injection:** When the user engages in conversation, Rekvin automatically injects a summary of the current **Session Log** into the agent's turn. This ensures the agent remembers what it just did, enabling intelligent answers to questions like "Why did you click that?".
- **Multimodal Tool Use:** Gemini uses function calling to control Playwright directly (click, type, scroll, wait), closing the loop between vision and action.

### 2. User Voice Intervention & Chat UI
Rekvin enables a uniquely collaborative research flow via the Multimodal Live API.
- **Real-Time Guidance:** Users can activate their microphone at any time to speak to the autonomous agent. 
 
- **Barge-in Support:** You can interrupt the agent's narration or redirect its testing strategy mid-session. The agent listens to your voice stream while simultaneously processing its vision and audio output.
- **Smart Transcript Grouping:** A dedicated **Transcription Hub** uses a grouping heuristic to combine streaming, word-by-word transcripts into clean, readable chat bubbles. It automatically groups consecutive segments by role (User/Agent) and resets pacing based on natural conversational pauses.
- **Seamless PCM Audio:** Leveraging Web Audio API's `AudioContext`, the engine schedules raw 24kHz PCM chunks back-to-back for a perfect, gapless voice experience.
- **Premium Gemini TTS Integration:** Migrated from browser-native speech to the **Gemini TTS** API (`/api/tts`). All synthetic speech uses premium Gemini voices, with the persona's description passed as a **Style Prompt** to ensure the voice matches the character's personality and tone.
- **Gender-Aware Voice Mapping:** The system automatically categorizes personas based on their name and description using an AI classifier. It then assigns a corresponding male (`Charon`), female (`Aoede`), or neutral (`Puck`) premium voice during the initial creation phase or workflow execution.
- **Post-Session Debriefing Flow:** After a test concludes, the "Talk to Agent" mode initializes the chat by injecting the internal **Session Log** (including the agent's hidden thoughts, manual narrations, and metric results). This grounds the agent's responses, allowing it to explain its reasoning post-hoc with perfect recall of the session.
- **On-Canvas Voice Trial:** Users can audition persona voices directly from the node palette. Every Persona node includes a "Voice Trial" button that triggers a character-consistent greeting sample using the Gemini TTS API, allowing for rapid iteration of persona personality during the design phase.

### 3. Visual Metrics Hub & Behavioral Analysis
The Metrics Hub transforms raw session recordings into actionable, quantitative data.
- **Compact Grid Visualization:** Saved sessions are presented in a responsive, multi-column card layout. This allows researchers to scan dozens of sessions at a glance.
- **Expandable Deep Dives:** Clicking a session card triggers a smooth, layout-aware expansion. This modal-like view surface the full behavioral story, comparative metrics, and the step-by-step action transcript.
- **Multimodal Evaluation:** Gemini analyzes the session breadcrumbs and visual state changes to calculate specific metrics such as *Time-to-Completion*, *Comprehension Risk*, and *Dead-end Encounters*.
- **Diagnostic Verdicts:** Every calculated metric includes a structured **Verdict**. This represents an AI-driven expert analysis that explains *why* a specific friction point occurred based on the persona's psychological profile.
- **Downloadable Reports:** Synthesized diagnostic reports can be exported as Markdown files, making it easy to share UX findings with the broader product team.

## 🧠 Persona Calibration & Calibration
Rekvin ensures your research is grounded in reality through a dual-calibration system.

### 1. Pre-Test: Evidence Quality Score
Before a persona is deployed, the engine calculates a **Quality Score (0-100)**. This is a heuristic analysis of the persona's supporting evidence:
- **Coverage:** How many ideas, assumptions, and research nodes are connected?
- **Diversity:** Are the sources varied (e.g., direct quotes vs. market research)?
- **Specificity:** Are the behavioral traits concrete and testable?
A low score warns the researcher that the agent may "hallucinate" behavior due to lack of grounding data.

### 2. Post-Test: Behavioral Validation (Persona-Fit)
After testing, the Metrics Hub is used to validate the persona model itself.
- **Expectation vs. Reality:** Comparing the agent's "Narration" (what it *said* it was doing) with the "Technical Outcome" (the specific metric value).
- **Refining the Archetype:** If an agent with "High Tech Literacy" fails at basic navigation, the researcher can use the diagnostic report to either fix the UI or recalibrate the persona's literacy parameter for better accuracy.

## 🛠 Technical Details
- **Frontend:** React 19, Vite, Tailwind CSS (v4), Motion (Framer Motion).
- **Visual Engine:** `@xyflow/react` (React Flow) v12 for the interactive canvases.
- **Backend:** Node.js (Express) server running a Playwright-powered browser automation loop and acting as a secure Vertex AI proxy for frontend clients.
- **Cloud-Native ADC Auth:** Uses `google-auth-library` to authenticate with Vertex AI via Service Account keys or local ADC, eliminating the need to expose API keys for Live connections.
- **Hybrid Speech Engine:** Custom Web Audio logic that blends raw 24kHz PCM chunks from Vertex AI (live) with a robust **Gemini TTS queueing system** for thoughts, fallbacks, and post-session chat.
- **AI SDK:** Vertex AI GA models for real-time interaction, reasoning, and high-fidelity speech synthesis.
 
 
## 🌍 Cloud Deployment
Rekvin is deployed on **Google Cloud Run** for high scalability and low latency.
- **Official Link:** [https://rekvin-engine-149602919559.us-central1.run.app/](https://rekvin-engine-149602919559.us-central1.run.app/)
- **Optimization:** Configured with 1GiB RAM and `session-affinity` to support stable multimodal agent sessions and real-time audio streaming.


## 🧠 The "Persona" Node Structure
A Persona in Rekvin is more than just a description. It's a structured entity including:
- **Core Insights:** Synthesized from connected Research, Assumption, and Tension nodes.
- **Behavioral Fields:** Extracted metadata like "Tech Literacy", "Patience", and "Primary Device".
- **Quality Score:** An AI-generated metric indicating the depth and validity of the persona based on its supporting nodes (Ideas, Assumptions, Research).
