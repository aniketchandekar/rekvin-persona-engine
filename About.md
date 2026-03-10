# About Rekvin

Rekvin is an AI-powered UX research and autonomous testing platform. It allows product teams to build user archetypes (personas) through a visual node-based workflow and then deploy those personas as autonomous agents to test real-world web applications.

## 🚀 How it Uses Gen AI (Gemini SDK)

This project is built from the ground up to showcase the multimodal, reasoning, and synthesis capabilities of the Google Gemini models (`gemini-2.0-flash`, `gemini-1.5-flash-8b`, and `gemini-3.1`).

### 1. Multimodal Live Agent (`gemini-2.5-flash-native-audio-preview`)
The core of the testing engine is a Playwright-driven agent loop powered by the **Gemini Multimodal Live API**.
- **1FPS Real-Time Vision:** Instead of static polling, the agent streams the browser's viewport at 1 frame per second. Gemini "sees" the UI continuously to understand animations, state changes, and interactive flow.
- **Autonomous Initialization:** The agent immediately begins its testing session upon page load, narrating its first impressions and taking actions without requiring initial user input.
- **Multimodal Tool Use:** Gemini uses function calling to control Playwright directly (click, type, scroll, wait), closing the loop between vision and action.
- **Optional Session Goals:** Agents can either be given a specific objective (e.g., "Find the checkout page") or explore the application freely to discover friction points.
- **Low-Latency Audio Monologue:** The agent narrates its "thoughts" in real-time. You hear its reasoning as it happens, with no delay between vision and speech.

### 2. User Voice Intervention & Barge-in
Rekvin enables a uniquely collaborative research flow via the Multimodal Live API.
- **Real-Time Guidance:** Users can activate their microphone at any time to speak to the autonomous agent. 
- **Barge-in Support:** You can interrupt the agent's narration or redirect its testing strategy mid-session. The agent listens to your voice stream while simultaneously processing its vision and audio output.
- **Seamless PCM Audio:** Leveraging Web Audio API's `AudioContext`, the engine schedules raw 24kHz PCM chunks back-to-back for a perfect, gapless voice experience.

### 3. Visual Metrics Hub & Behavioral Analysis
The Metrics Hub transforms raw session recordings into actionable, quantitative data.
- **Session-to-Metric Mapping:** Users drag "Session" nodes (containing the agent's action history and vision data) and connect them to specific "Metric" nodes.
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
- **Backend:** Node.js (Express) server running a Playwright-powered browser automation loop using the **Gemini Multimodal Live API**.
- **Autoplay-Aware Audio Scheduling:** Custom Web Audio logic for zero-latency, gapless PCM audio output, with interaction-triggered initialization to bypass browser autoplay restrictions.
- **AI SDK:** `@google/genai` (Google Generative AI SDK for Node.js).

## 🧠 The "Persona" Node Structure
A Persona in Rekvin is more than just a description. It's a structured entity including:
- **Core Traits:** Captured via Socratic interview.
- **Behavioral Fields:** Extracted metadata like "Tech Literacy", "Patience", and "Primary Device".
- **Quality Score:** An AI-generated metric indicating the depth and validity of the persona based on its supporting nodes (Ideas, Assumptions, Research).
