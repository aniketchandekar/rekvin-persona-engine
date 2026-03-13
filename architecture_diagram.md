# Rekvin: Architecture Diagram

This diagram illustrates how Rekvin's React frontend securely communicates with Google Cloud AI services via a Node.js proxy deployed on Cloud Run, incorporating the new Gemini TTS and Post-Session debriefing flows.

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:white;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:white;
    classDef google fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:white;
    classDef deployment fill:#6366f1,stroke:#4338ca,stroke-width:2px,color:white;
    classDef actor fill:#64748b,stroke:#334155,stroke-width:2px,color:white;

    %% Actors
    User((UX Researcher / User)):::actor

    subgraph "Local Development / Deployment"
        Code[Source Code <br><i>GitHub Repo</i>]:::deployment
        CloudBuild[Google Cloud Build <br><i>Containerization</i>]:::deployment
        GCR[Container Registry <br><i>Artifact Storage</i>]:::deployment
    end

    subgraph "Frontend Layer (React 19 / Vite)"
        UI[User Interface <br><i>Dashboard, Node Editor, Metrics Hub</i>]:::frontend
        AgentEngine[Live Agent Engine <br><i>WebSockets, Web Audio, Playwright Bridge</i>]:::frontend
        TTSQueue[Audio Manager <br><i>Dual-Path: PCM + TTS Queue</i>]:::frontend
    end

    subgraph "Google Cloud Platform"
        subgraph "Application Hosting (Cloud Run)"
            BackendProxy[Node.js Proxy Server <br><i>Vertex AI Relay</i>]:::backend
            ADC[Google Auth Library <br><i>ADC for IAM Roles</i>]:::backend
        end

        subgraph "AI & ML Services (Vertex AI)"
            GeminiLive[Multimodal Live API <br><i>gemini-live-2.5-flash-native-audio</i>]:::google
            GeminiREST[Generative AI REST <br><i>2.5-flash/pro: Chat, Analysis, Classifiers</i>]:::google
            GeminiTTS[Vertex AI TTS <br><i>gemini-2.5-flash-tts: Premium Voices</i>]:::google
        end
    end

    %% Deployment Path
    Code -- "git push / deploy.sh" --> CloudBuild
    CloudBuild -- "Docker Push" --> GCR
    GCR -- "Service Deployment" --> BackendProxy

    %% Main Interactions
    User -- "Builds Personas, Interacts" --> UI
    User -- "Voice/Video Stream" --> AgentEngine

    %% Live API Connection
    AgentEngine -- "Secure WebSocket (WSS) <br> Native Audio + Vision" --> GeminiLive
    GeminiLive -- "AI Native PCM stream" --> TTSQueue
    
    %% REST / Logic Path
    UI -- "Config: Persona Voice DNA" --> BackendProxy
    BackendProxy -- "Gender Analysis" --> GeminiREST
    
    %% TTS Logic
    AgentEngine -- "Synthesize Thoughts/Chat" --> BackendProxy
    BackendProxy -- "Request Voice Synthesis" --> GeminiTTS
    GeminiTTS -- "High-Fidelity Audio Buffer" --> BackendProxy
    BackendProxy -- "Base64 Audio" --> TTSQueue

    %% Post-Session Debrief
    UI -- "Post-Session Chat <br> + Full Session context" --> BackendProxy
    BackendProxy -- "Grounded Debriefing" --> GeminiREST
```

### Component Breakdown
1. **Frontend Layer**: A React SPA that captures microphone input and screen content at 1fps. It uses a **Dual-Path Audio Manager** that seamlessly blends the raw 24kHz PCM stream from the Live API with high-fidelity speech from the **Gemini TTS Queue** for thoughts and post-session conversations.
2. **Backend Proxy (Cloud Run)**: Acts as a secure relay for Vertex AI. It handles **Gender-Aware Voice Mapping** (categorizing personas to assign `Aoede`, `Charon`, or `Puck`), grounds **Post-Session Debriefs** by injecting full session logs into the chat, and provides a clean REST API for non-websocket features.
3. **AI Services (Vertex AI)**: 
    - **Multimodal Live API**: Zero-latency testing and voice-to-voice interaction.
    - **Gemini REST**: High-reasoning models for session analysis, metrics calculation, and persona-fit verdicts.
    - **Gemini TTS**: Premium voice synthesis that provides character-consistent narration with built-in personality prompts.
4. **Automated Deployment**: The project is containerized via a custom Playwright-ready `Dockerfile` and deployed using `deploy.sh`, which triggers **Google Cloud Build** to push images to **GCR** and refresh the **Cloud Run** service.
