# Rekvin: Architecture Diagram

This diagram illustrates how Rekvin's React frontend securely communicates with Google Cloud AI services via a Node.js proxy deployed on Cloud Run.

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:white;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:white;
    classDef google fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:white;
    classDef database fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:white;
    classDef actor fill:#64748b,stroke:#334155,stroke-width:2px,color:white;

    %% Actors
    User((UX Researcher / User)):::actor

    subgraph "Frontend Layer (React 19 / Vite)"
        UI[User Interface <br><i>Dashboard, Node Editor, Testing Hub</i>]:::frontend
        AgentEngine[Live Agent Interaction Engine <br><i>Handles WebSockets, Web Audio API, Canvas</i>]:::frontend
    end

    subgraph "Google Cloud Platform"
        subgraph "Application Hosting"
            BackendProxy[Node.js Proxy Server <br><i>Hosted on Cloud Run</i>]:::backend
            ADC[Google Auth Library <br><i>Application Default Credentials</i>]:::backend
        end

        subgraph "AI & ML Services"
            GeminiLive[Vertex AI: Gemini Live API <br><i>gemini-live-2.5-flash-native-audio</i>]:::google
            GeminiREST[Vertex AI: REST API <br><i>gemini-2.5-flash / gemini-2.5-pro</i>]:::google
            CloudTTS[Google Cloud Text-to-Speech <br><i>Audio synthesis fallback</i>]:::google
        end
    end

    %% Connections
    User -- "Builds Personas, Assigns Goals" --> UI
    User -- "Voice Audio (Mic)" --> AgentEngine
    UI -- "Configures Session" --> AgentEngine

    %% Live API Connection
    AgentEngine -- "Secure WebSocket (WSS) <br> Raw PCM Audio + Base64 Video Frames" --> GeminiLive
    GeminiLive -- "WSS stream <br> AI Voice Audio + Text Transcript" --> AgentEngine
    AgentEngine -- "Smart Grouping <br> Turns transcription stream into sentences" --> UI
    AgentEngine -- "Session Log Context <br> Injects action history into conversation" --> GeminiLive

    %% Proxy Connections (REST)
    UI -- "REST (JSON) <br> <i>Requests Chat, Analytics, Generators</i>" --> BackendProxy
    BackendProxy -- "Authenticates Service Account via" --> ADC
    ADC -. "Provides secure auth tokens" .-> GeminiREST
    ADC -. "Provides secure auth tokens" .-> CloudTTS
    
    BackendProxy -- "Relays Prompts & Media" --> GeminiREST
    BackendProxy -- "Requests Audio Synthesis" --> CloudTTS
    
    GeminiREST -- "JSON Responses" --> BackendProxy
    CloudTTS -- "Base64 MP3 Audio" --> BackendProxy
    BackendProxy -- "Secure Responses" --> UI
```

### Component Breakdown
1. **Frontend Layer**: A React SPA that captures microphone input, screen content at 1fps, and renders the application state. It connects *directly* to the Gemini Live API via standard WebSockets for minimum latency during live sessions.
2. **Backend Proxy (Cloud Run)**: For all non-live AI generation (analytics reports, chatbot interactions, TTS fallbacks, visual persona building), the frontend pings our Node server. This completely obscures the API keys and GCP resources from malicious client-side use.
3. **Google Auth Library (ADC)**: The backend relies on Application Default Credentials attached to its Google Cloud service account to access Vertex AI securely without needing hardcoded keys in [.env](file:///Users/aniket/Desktop/rekvin/Projects/rekvin---persona-engine/.env) files.
4. **AI Services**: We route live interaction traffic heavily to the new `gemini-live-2.5-flash-native-audio` model on Vertex, fallback analysis/generation to standard `gemini-2.5-flash`, and synthesize fallback voices using Google Cloud Text-to-Speech API.
