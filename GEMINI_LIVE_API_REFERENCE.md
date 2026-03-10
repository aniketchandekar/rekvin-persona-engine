# Gemini Live API — Agent Reference README

> **Purpose:** This file is a complete implementation reference for an AI coding agent building with the Gemini Live API. Read this before writing any Live API code. Every section contains copy-paste-ready patterns, critical constraints, and Rekvin-specific notes.

---

## Table of Contents

1. [What the Live API Is](#1-what-the-live-api-is)
2. [Models](#2-models)
3. [Implementation Approach — Server vs Client](#3-implementation-approach--server-vs-client)
4. [Connecting — SDK (Preferred)](#4-connecting--sdk-preferred)
5. [Connecting — Raw WebSockets](#5-connecting--raw-websockets)
6. [Sending Inputs](#6-sending-inputs)
7. [Receiving Outputs](#7-receiving-outputs)
8. [Audio Formats — Critical Constraints](#8-audio-formats--critical-constraints)
9. [Voice Configuration](#9-voice-configuration)
10. [Tool Use — Function Calling + Search](#10-tool-use--function-calling--search)
11. [Session Management](#11-session-management)
12. [Ephemeral Tokens — Security](#12-ephemeral-tokens--security)
13. [System Prompt Best Practices](#13-system-prompt-best-practices)
14. [Rekvin Implementation Patterns](#14-rekvin-implementation-patterns)
15. [Common Errors and Fixes](#15-common-errors-and-fixes)
16. [Quick Reference Cheat Sheet](#16-quick-reference-cheat-sheet)

---

## 1. What the Live API Is

The Live API enables **low-latency, real-time bidirectional communication** with Gemini over a persistent WebSocket connection. It is not a request/response API — it is a streaming session.

**What makes it different from regular Gemini API:**
- Persistent connection — one session, continuous stream, not per-request
- Handles audio, video, and text inputs simultaneously
- Produces native audio output (not TTS post-processing — native voice generation)
- Supports interruption — user can speak while model is speaking
- Voice activity detection (VAD) built in — detects when user starts/stops speaking

**What it is NOT:**
- Not for batch processing
- Not for exact text recitation with fine-grained voice control (use TTS API for that)
- Not a REST API — everything is WebSocket

**The Live API vs TTS API distinction (important for Rekvin):**

| Use Case | Use This |
|----------|----------|
| Real-time voice interview (user speaks, Gemini responds) | Live API |
| Real-time persona narration during screen navigation | Live API |
| Post-test debrief audio (clean, polished, controlled) | TTS API (`gemini-2.5-flash-preview-tts`) |
| Replaying a specific narration quote in results UI | TTS API |

---

## 2. Models

**Always use one of these models for Live API — no other model supports it:**

```
gemini-2.5-flash-native-audio-preview-12-2025   ← PRIMARY — use this
gemini-2.0-flash-live-001                        ← fallback if above unavailable
```

**Supported tools by model:**

| Tool | `gemini-2.5-flash-native-audio-preview-12-2025` |
|------|-------------------------------------------------|
| Google Search | ✅ Yes |
| Function calling | ✅ Yes |
| Google Maps | ❌ No |
| Code execution | ❌ No |
| URL context | ❌ No |

---

## 3. Implementation Approach — Server vs Client

There are two ways to connect to the Live API. **Choose before writing any code.**

### Approach A — Server-to-API (Recommended for Rekvin)

```
Browser → Your FastAPI Server (Cloud Run) → Gemini Live API
```

- API key stays on your server — never exposed to browser
- Your FastAPI server relays audio/video between browser and Gemini
- More complex but secure
- **Use this for Rekvin** — API key must not be in browser

### Approach B — Client-to-API (Browser directly connects)

```
Browser → Gemini Live API (using ephemeral token)
```

- Browser connects directly via WebSocket
- API key replaced with a short-lived ephemeral token
- Simpler but requires ephemeral token provisioning from your backend
- See [Section 12 — Ephemeral Tokens](#12-ephemeral-tokens--security)

**For Rekvin: Use Approach A (server relay) for the interview agent. The FastAPI server on Cloud Run is already your backend — route all Live API traffic through it.**

---

## 4. Connecting — SDK (Preferred)

Install the SDK:

```bash
pip install google-genai
# or
npm install @google/genai
```

### Python — Basic Connection

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")
# Or use GOOGLE_API_KEY env var — client = genai.Client()

MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

config = {
    "response_modalities": ["AUDIO"],  # or ["TEXT"] or ["AUDIO", "TEXT"]
    "system_instruction": "You are Maya, a freelance designer...",
    "speech_config": types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Callirrhoe"  # see voice options in Section 9
            )
        )
    )
}

async def main():
    async with client.aio.live.connect(model=MODEL, config=config) as session:
        # session is now open — send and receive here
        pass

asyncio.run(main())
```

### JavaScript — Basic Connection

```javascript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const session = await ai.live.connect({
  model: MODEL,
  callbacks: {
    onopen: () => console.log('Session opened'),
    onmessage: (message) => handleMessage(message),
    onerror: (e) => console.error('Error:', e.message),
    onclose: (e) => console.log('Closed:', e.reason),
  },
  config: {
    responseModalities: [Modality.AUDIO],
    systemInstruction: 'You are Maya, a freelance designer...',
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: 'Callirrhoe' }
      }
    }
  }
});

// Always close when done
session.close();
```

---

## 5. Connecting — Raw WebSockets

Use this if you need lower-level control or are building the relay server in a language without a GenAI SDK.

**WebSocket endpoint:**
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
```

**Setup message (send immediately after connecting):**

```json
{
  "setup": {
    "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
    "generation_config": {
      "response_modalities": ["AUDIO"],
      "speech_config": {
        "voice_config": {
          "prebuilt_voice_config": { "voice_name": "Callirrhoe" }
        }
      }
    },
    "system_instruction": {
      "parts": [{ "text": "You are Maya..." }]
    }
  }
}
```

**Wait for setup complete before sending content:**
```json
{ "setupComplete": {} }
```

**Send audio:**
```json
{
  "realtimeInput": {
    "audio": {
      "mimeType": "audio/pcm;rate=16000",
      "data": "<base64-encoded-pcm-bytes>"
    }
  }
}
```

**Send video frame:**
```json
{
  "realtimeInput": {
    "video": {
      "mimeType": "image/jpeg",
      "data": "<base64-encoded-jpeg>"
    }
  }
}
```

---

## 6. Sending Inputs

### Send Text

```python
# Python
await session.send_realtime_input(text="Hello, how are you?")
```

```javascript
// JavaScript
session.sendRealtimeInput({ text: 'Hello, how are you?' });
```

### Send Audio (raw PCM — see format requirements in Section 8)

```python
# Python — chunk is raw PCM bytes
await session.send_realtime_input(
    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
)
```

```javascript
// JavaScript — chunk is a Buffer
session.sendRealtimeInput({
  audio: {
    data: chunk.toString('base64'),
    mimeType: 'audio/pcm;rate=16000'
  }
});
```

### Send Video Frame (for screen navigation agent)

```python
# Python — frame is JPEG bytes, max 1 frame per second
await session.send_realtime_input(
    video=types.Blob(data=frame, mime_type="image/jpeg")
)
```

```javascript
// JavaScript
session.sendRealtimeInput({
  video: {
    data: frame.toString('base64'),
    mimeType: 'image/jpeg'
  }
});
```

### ⚠️ Video Frame Rate Limit
**Maximum 1 frame per second.** Do not exceed this. For Rekvin's screen navigation agent, capture at 0.5–1fps (every 1–2 seconds).

### Send Incremental Text (for context injection)

```python
# Python — inject context without triggering a response
await session.send_client_content(
    turns=[{"role": "user", "parts": [{"text": "Context: user just loaded the checkout page"}]}],
    turn_complete=False  # False = don't respond yet, just add to context
)

# Set turn_complete=True when you want a response
await session.send_client_content(turn_complete=True)
```

---

## 7. Receiving Outputs

### Receive Audio Response

```python
# Python
async for response in session.receive():
    if response.server_content and response.server_content.model_turn:
        for part in response.server_content.model_turn.parts:
            if part.inline_data:
                audio_chunk = part.inline_data.data  # raw PCM bytes at 24kHz
                # stream to client or buffer for playback

    # Check for turn completion
    if response.server_content and response.server_content.turn_complete:
        print("Model finished speaking")
```

```javascript
// JavaScript — inside onmessage callback
function handleMessage(response) {
  const content = response.serverContent;
  if (content?.modelTurn?.parts) {
    for (const part of content.modelTurn.parts) {
      if (part.inlineData) {
        const audioData = part.inlineData.data; // base64 PCM at 24kHz
        playAudio(audioData);
      }
      if (part.text) {
        // text transcript if TEXT modality enabled
        appendTranscript(part.text);
      }
    }
  }
  if (content?.turnComplete) {
    console.log('Model finished turn');
  }
}
```

### Receive Text Response (when TEXT modality enabled)

Set `response_modalities: ["TEXT"]` or `["AUDIO", "TEXT"]` in config. Then text arrives in `part.text` inside model_turn parts (same structure as audio above).

### Detect Interruption

```python
# Python — model was interrupted (user spoke while model was speaking)
async for response in session.receive():
    if response.server_content and response.server_content.interrupted:
        print("Model was interrupted — stop playing audio")
        clear_audio_buffer()
```

### Detect Voice Activity (user start/stop speaking)

```python
async for response in session.receive():
    if response.server_content:
        if response.server_content.input_transcription:
            # User speech being transcribed in real-time
            transcript = response.server_content.input_transcription.text
        
        if response.server_content.generation_complete:
            # Full response cycle complete
            pass
```

---

## 8. Audio Formats — Critical Constraints

**Get these wrong and audio will be garbled or rejected.**

| Parameter | Input (browser → API) | Output (API → browser) |
|-----------|----------------------|------------------------|
| Format | Raw PCM | Raw PCM |
| Bit depth | 16-bit | 16-bit |
| Byte order | Little-endian | Little-endian |
| Sample rate | 16kHz (preferred) — other rates accepted with resampling | 24kHz always |
| Channels | Mono | Mono |
| MIME type | `audio/pcm;rate=16000` | N/A (received as raw bytes) |

**Always specify sample rate in MIME type:**
```python
mime_type="audio/pcm;rate=16000"   # correct
mime_type="audio/pcm"              # missing rate — will be assumed, may be wrong
```

**Capturing audio from browser (JavaScript):**
```javascript
// Get mic access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Use AudioContext to convert to correct format
const audioContext = new AudioContext({ sampleRate: 16000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
  const float32 = e.inputBuffer.getChannelData(0);
  // Convert float32 to int16 PCM
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  // Send as base64
  const buffer = Buffer.from(int16.buffer);
  websocket.send(JSON.stringify({
    type: 'audio',
    data: buffer.toString('base64')
  }));
};

source.connect(processor);
processor.connect(audioContext.destination);
```

**Playing audio output in browser (JavaScript):**
```javascript
async function playPCMAudio(base64Data) {
  const raw = atob(base64Data);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  
  const audioContext = new AudioContext({ sampleRate: 24000 }); // output is always 24kHz
  const buffer = audioContext.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
}
```

---

## 9. Voice Configuration

30 available voices. Set in session config — cannot be changed mid-session.

**Recommended voices for Rekvin persona types:**

| Persona Characteristic | Voice | Quality |
|------------------------|-------|---------|
| Patient, thoughtful user | `Sulafat` | Warm |
| Fast, confident power user | `Puck` | Upbeat |
| Anxious, low-patience user | `Enceladus` | Breathy |
| Average/neutral user | `Callirrhoe` | Easy-going |
| Expert professional | `Charon` | Informative |
| Young, casual user | `Leda` | Youthful |
| Hesitant, cautious user | `Achernar` | Soft |
| Friendly, approachable | `Achird` | Friendly |

**Full voice list:**
`Zephyr` (Bright), `Puck` (Upbeat), `Charon` (Informative), `Kore` (Firm), `Fenrir` (Excitable), `Leda` (Youthful), `Orus` (Firm), `Aoede` (Breezy), `Callirrhoe` (Easy-going), `Autonoe` (Bright), `Enceladus` (Breathy), `Iapetus` (Clear), `Umbriel` (Easy-going), `Algieba` (Smooth), `Despina` (Smooth), `Erinome` (Clear), `Algenib` (Gravelly), `Rasalgethi` (Informative), `Laomedeia` (Upbeat), `Achernar` (Soft), `Alnilam` (Firm), `Schedar` (Even), `Gacrux` (Mature), `Pulcherrima` (Forward), `Achird` (Friendly), `Zubenelgenubi` (Casual), `Vindemiatrix` (Gentle), `Sadachbia` (Lively), `Sadaltager` (Knowledgeable), `Sulafat` (Warm)

**Setting voice in Python:**
```python
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                voice_name="Callirrhoe"
            )
        )
    )
}
```

**⚠️ Voice cannot be changed after session starts.** Store `voice_name` on the PersonaNode and pass it at session creation time.

---

## 10. Tool Use — Function Calling + Search

### Defining Tools in Session Config

```python
# Python
tools = [
    {
        "function_declarations": [
            {
                "name": "record_navigation_action",
                "description": "Record an action the persona is taking on screen",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["click", "type", "scroll", "wait", "abandon"]
                        },
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                        "description": {"type": "string"},
                        "fallback_text": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["action", "description"]
                }
            }
        ]
    }
]

config = {
    "response_modalities": ["AUDIO"],
    "tools": tools,
    "system_instruction": "..."
}
```

### Handling Tool Calls (Python)

```python
async for response in session.receive():
    # Check for tool call
    if response.tool_call:
        for fc in response.tool_call.function_calls:
            tool_name = fc.name
            args = dict(fc.args)
            call_id = fc.id
            
            # Execute the tool
            result = await execute_tool(tool_name, args)
            
            # MUST respond — Live API does NOT auto-handle tool responses
            await session.send_tool_response(
                function_responses=[
                    types.FunctionResponse(
                        id=call_id,
                        name=tool_name,
                        response={"result": result}
                    )
                ]
            )
```

### ⚠️ Tool Response is Mandatory
Unlike the regular Gemini API, the Live API does **not** automatically handle tool responses. You must always call `send_tool_response` after receiving a tool call or the session will stall.

### Enabling Google Search

```python
config = {
    "tools": [{"google_search": {}}],
    "response_modalities": ["AUDIO"]
}
```

For Rekvin: use Google Search grounding in the Research Node trigger (Phase 8). Wire it as a separate Gemini call, not inside the Live session, to keep the session focused on conversation.

---

## 11. Session Management

### Session Limits (Critical)

| Session Type | Default Limit | With Compression |
|--------------|--------------|-----------------|
| Audio only | 15 minutes | Unlimited |
| Audio + Video | 2 minutes | Unlimited |
| Connection lifetime | ~10 minutes | Use session resumption |

**For Rekvin's interview session (audio only, ~8 minutes): you are within the default 15-minute limit. No compression needed.**

**For Rekvin's testing agent session (audio + video): 2-minute default limit. You MUST enable context window compression or the session will terminate mid-test.**

### Enabling Context Window Compression

```python
config = {
    "response_modalities": ["AUDIO"],
    "context_window_compression": {
        "trigger_tokens": 25600,  # compress when context exceeds this
        "sliding_window": {
            "target_tokens": 12800  # keep this many tokens after compression
        }
    }
}
```

### Session Resumption (reconnecting across connection drops)

```python
# On first connection — save the session handle
session_handle = None

async for response in session.receive():
    if response.session_resumption_update:
        if response.session_resumption_update.resumable:
            session_handle = response.session_resumption_update.new_handle

# On reconnection — resume with saved handle
config = {
    "response_modalities": ["AUDIO"],
    "session_resumption": {"handle": session_handle}
}
async with client.aio.live.connect(model=MODEL, config=config) as session:
    # session resumes from where it left off
```

### GoAway Message (connection about to close)

```python
async for response in session.receive():
    if response.go_away:
        time_left = response.go_away.time_left  # seconds before termination
        print(f"Connection closing in {time_left}s — save session handle now")
        # Save session_handle and reconnect
```

### Clean Session Close

```python
# Python
await session.close()

# JavaScript
session.close();
```

---

## 12. Ephemeral Tokens — Security

Use ephemeral tokens when the browser connects **directly** to the Live API (Approach B). Do not use for server-relay architecture.

### How It Works

1. Browser authenticates with your backend
2. Your backend calls Gemini API to mint a token
3. Gemini returns a short-lived token (expires quickly)
4. Backend sends token to browser
5. Browser uses token instead of API key for WebSocket connection

### Minting a Token (Python — your backend)

```python
import google.auth
import google.auth.transport.requests

def mint_ephemeral_token(project_id: str, system_instruction: str) -> str:
    """Call from your FastAPI backend — never from browser."""
    
    credentials, _ = google.auth.default()
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    
    # Exchange for ephemeral token
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/ephemeralTokens",
        headers={"Authorization": f"Bearer {credentials.token}"},
        json={
            "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
            "config": {
                "system_instruction": system_instruction,
                "response_modalities": ["AUDIO"]
            }
        }
    )
    return response.json()["name"]  # This is your ephemeral token
```

### Using the Token in Browser (JavaScript)

```javascript
// 1. Get token from your backend
const { token } = await fetch('/api/mint-token').then(r => r.json());

// 2. Use token instead of API key
const ai = new GoogleGenAI({ apiKey: token });  // swap API key for token
const session = await ai.live.connect({ model: MODEL, config: config });
```

### ⚠️ Token Constraints
- Short-lived — expires in minutes
- One-use per session
- Can be configured with restricted permissions (e.g., specific model only)
- Only works with Live API — not other Gemini endpoints

**For Rekvin: Since you are using server-relay (Approach A), you do NOT need ephemeral tokens. The API key stays on Cloud Run. Skip this for the hackathon build.**

---

## 13. System Prompt Best Practices

Structure every Live API system prompt in this exact order:

### Template

```
1. AGENT PERSONA
   - Name, role, core characteristics
   - Accent and language (specify both together)

2. CONVERSATIONAL RULES
   - One-time steps (do once and move on)
   - Conversational loops (can repeat freely)
   - Explicit sequencing: "First do X. Then do Y. Then Z."

3. TOOL CALL INSTRUCTIONS
   - When exactly to call each tool
   - "After receiving the user's answer, invoke [tool_name] with..."

4. GUARDRAILS
   - What NOT to do
   - If X happens, do Y
   - Use "unmistakably" for critical precision requirements
```

### Rekvin Interview Agent System Prompt

```
You are Rekvin's interview agent. Your job is to conduct a structured 
10-question interview to help a developer understand their user persona.

CONVERSATIONAL RULES:
One-time setup: Begin by acknowledging their idea in one sentence. 
Then ask question 1.

Interview loop (repeat for each question):
- Ask one question at a time. Never ask two questions in the same turn.
- For questions about user types or behaviors, generate exactly 3-4 
  multiple choice options. Read them aloud clearly.
- After any key claim, ask "What makes you think that?" before moving on.
- After receiving the user's answer, invoke record_node with the 
  extracted node data before proceeding to the next question.

After question 10: Say "I have enough to give you a starting point. 
Here's what the canvas looks like — take it from here." Then invoke 
finalize_interview.

GUARDRAILS:
Never ask more than 10 questions total.
Never skip invoking record_node after an answer — unmistakably call it 
every single time before the next question.
If the user says "skip" or "I don't know", accept it and mark the 
parameter as assumed rather than pressing further.
```

### Rekvin Persona Testing Agent System Prompt

```
You are [PERSONA_NAME], a [ARCHETYPE].

Your characteristics:
- Cognitive load: [X]/5 — [description of what this means for behavior]
- Tech-savviness: [X]/5 — [description]
- Patience: [X]/5 — [description]  
- Emotional state: [state when using this product]
- Device: [device type]
- Environment: [physical setting and distractions]

You are navigating a web application to complete: [journey steps].

NARRATION RULES:
- Narrate out loud in first person what you see and what you're thinking
- Stay completely in character — your knowledge and vocabulary is 
  constrained by your parameters above
- Express confusion, frustration, or delight as your persona would

ACTION RULES — after each narration, invoke navigate_action with:
{"action": "click", "x": N, "y": N, "description": "...", "fallback_text": "..."}
{"action": "type", "text": "...", "x": N, "y": N}
{"action": "scroll", "direction": "down"/"up", "amount": N}
{"action": "wait", "reason": "..."}
{"action": "abandon", "reason": "..."}

GUARDRAILS:
Unmistakably call navigate_action after every narration — never narrate 
without following up with an action.
If you have been on the same screen for more than [patience_threshold] 
seconds without progress, invoke navigate_action with action: "abandon".
Never break character by referencing your parameters directly.
```

---

## 14. Rekvin Implementation Patterns

### Pattern 1 — Interview Session (FastAPI relay)

```python
# fastapi_server.py

from fastapi import FastAPI, WebSocket
from google import genai
from google.genai import types
import asyncio
import json

app = FastAPI()
client = genai.Client()
MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

@app.websocket("/ws/interview/{project_id}")
async def interview_session(websocket: WebSocket, project_id: str):
    await websocket.accept()
    
    # Load project from Firestore
    project = await get_project(project_id)
    
    config = {
        "response_modalities": ["AUDIO", "TEXT"],
        "system_instruction": build_interview_prompt(project.idea),
        "speech_config": types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Achird"  # Friendly for interview
                )
            )
        ),
        "tools": [RECORD_NODE_TOOL, FINALIZE_INTERVIEW_TOOL]
    }
    
    async with client.aio.live.connect(model=MODEL, config=config) as session:
        # Run send and receive concurrently
        await asyncio.gather(
            relay_browser_to_gemini(websocket, session),
            relay_gemini_to_browser(websocket, session, project_id)
        )

async def relay_browser_to_gemini(websocket: WebSocket, session):
    """Forward browser audio/text to Gemini Live."""
    async for message in websocket.iter_text():
        data = json.loads(message)
        
        if data["type"] == "audio":
            await session.send_realtime_input(
                audio=types.Blob(
                    data=bytes.fromhex(data["data"]),
                    mime_type="audio/pcm;rate=16000"
                )
            )
        elif data["type"] == "text":
            await session.send_realtime_input(text=data["text"])

async def relay_gemini_to_browser(websocket: WebSocket, session, project_id: str):
    """Forward Gemini responses to browser and handle tool calls."""
    async for response in session.receive():
        # Audio response — forward to browser for playback
        if response.server_content and response.server_content.model_turn:
            for part in response.server_content.model_turn.parts:
                if part.inline_data:
                    await websocket.send_json({
                        "type": "audio",
                        "data": part.inline_data.data.hex()
                    })
                if part.text:
                    await websocket.send_json({
                        "type": "transcript",
                        "text": part.text
                    })
        
        # Tool call — execute and respond
        if response.tool_call:
            for fc in response.tool_call.function_calls:
                result = await handle_tool_call(fc.name, dict(fc.args), project_id)
                await session.send_tool_response(
                    function_responses=[
                        types.FunctionResponse(
                            id=fc.id,
                            name=fc.name,
                            response={"result": result}
                        )
                    ]
                )
                # Also send node update to browser
                await websocket.send_json({
                    "type": "node_planted",
                    "node": result
                })
        
        # Interruption — tell browser to stop playing audio
        if response.server_content and response.server_content.interrupted:
            await websocket.send_json({"type": "interrupted"})
```

### Pattern 2 — Screen Navigation Session (with video input)

```python
@app.websocket("/ws/test/{project_id}/{persona_id}")
async def test_session(websocket: WebSocket, project_id: str, persona_id: str):
    await websocket.accept()
    
    persona = await get_persona(persona_id)
    
    config = {
        "response_modalities": ["AUDIO", "TEXT"],
        "system_instruction": build_persona_navigation_prompt(persona),
        "speech_config": types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=persona.voice_name  # stored on PersonaNode
                )
            )
        ),
        # CRITICAL: enable compression for audio+video sessions
        "context_window_compression": {
            "trigger_tokens": 25600,
            "sliding_window": {"target_tokens": 12800}
        },
        "tools": [NAVIGATE_ACTION_TOOL]
    }
    
    async with client.aio.live.connect(model=MODEL, config=config) as session:
        await asyncio.gather(
            relay_frames_to_gemini(websocket, session),
            relay_gemini_actions_to_browser(websocket, session, project_id)
        )

async def relay_frames_to_gemini(websocket: WebSocket, session):
    """Receive screen frames from browser and send to Gemini."""
    async for message in websocket.iter_text():
        data = json.loads(message)
        
        if data["type"] == "frame":
            # JPEG frame from browser's getDisplayMedia()
            frame_bytes = bytes.fromhex(data["data"])
            await session.send_realtime_input(
                video=types.Blob(data=frame_bytes, mime_type="image/jpeg")
            )
        elif data["type"] == "audio":
            # Optional: user can speak during test session
            await session.send_realtime_input(
                audio=types.Blob(
                    data=bytes.fromhex(data["data"]),
                    mime_type="audio/pcm;rate=16000"
                )
            )
```

### Pattern 3 — Browser Screen Capture (frontend, JavaScript)

```javascript
// Capture browser tab and send frames to FastAPI
async function startScreenCapture(websocket) {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 1 },  // 1fps matches Live API max
    audio: false
  });
  
  const track = stream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(track);
  
  const captureInterval = setInterval(async () => {
    try {
      const bitmap = await imageCapture.grabFrame();
      
      // Render to canvas and compress to JPEG
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(bitmap.width, 1280);  // cap resolution
      canvas.height = Math.min(bitmap.height, 720);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      
      // Get as base64 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];
      
      // Send to FastAPI relay
      websocket.send(JSON.stringify({
        type: 'frame',
        data: base64,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Frame capture failed:', e);
    }
  }, 1000); // every 1 second
  
  return () => {
    clearInterval(captureInterval);
    stream.getTracks().forEach(t => t.stop());
  };
}
```

---

## 15. Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Session terminated after 2 minutes` | Audio+video without compression | Enable `context_window_compression` in config |
| `Audio garbled / robotic` | Wrong sample rate | Ensure input is 16kHz PCM, output playback at 24kHz |
| `Tool call stalls session` | Missing `send_tool_response` | Always call `send_tool_response` after every tool call |
| `Model stops responding mid-session` | Context window overflow | Enable compression or reduce video frame rate |
| `WebSocket connection refused` | API key in browser | Move to server-relay pattern or use ephemeral tokens |
| `Voice not applying` | Voice set after session start | Voice must be set in initial config — cannot change mid-session |
| `Model speaks too fast / out of character` | System prompt too vague | Use the structured 4-part prompt template (Section 13) |
| `Setup timeout` | Not waiting for setupComplete before sending | Always wait for `setupComplete` message before sending content (WebSocket only) |
| `GoAway received` | Connection approaching 10-min lifetime | Save session handle, reconnect using session resumption |

---

## 16. Quick Reference Cheat Sheet

```
MODEL:          gemini-2.5-flash-native-audio-preview-12-2025

AUDIO IN:       raw PCM, 16-bit, little-endian, 16kHz, mono
                mime_type="audio/pcm;rate=16000"

AUDIO OUT:      raw PCM, 16-bit, little-endian, 24kHz, mono
                (always 24kHz regardless of input rate)

VIDEO IN:       JPEG or PNG frames, max 1 frame/second
                mime_type="image/jpeg"

SESSION LIMITS: audio-only = 15min | audio+video = 2min
                connection = ~10min
                → enable context_window_compression for video sessions

TOOL CALLS:     MUST manually send_tool_response — not auto-handled

VOICE:          set in initial config only — cannot change mid-session

MODALITIES:     ["AUDIO"] | ["TEXT"] | ["AUDIO", "TEXT"]

INTERRUPTION:   built-in — model stops when user speaks
                detect via response.server_content.interrupted

SECURITY:       never put API key in browser
                use server-relay (Approach A) or ephemeral tokens (Approach B)

PYTHON PKG:     google-genai
JS PKG:         @google/genai

DOCS:           https://ai.google.dev/gemini-api/docs/live-api
EXAMPLES:       https://github.com/google-gemini/gemini-live-api-examples
AI STUDIO:      https://aistudio.google.com/live
```

---

## Source Documentation

| Topic | URL |
|-------|-----|
| Overview | https://ai.google.dev/gemini-api/docs/live-api |
| Get Started (SDK) | https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk |
| Get Started (WebSocket) | https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket |
| Capabilities | https://ai.google.dev/gemini-api/docs/live-api/capabilities |
| Tool Use | https://ai.google.dev/gemini-api/docs/live-api/tools |
| Session Management | https://ai.google.dev/gemini-api/docs/live-api/session-management |
| Ephemeral Tokens | https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens |
| Best Practices | https://ai.google.dev/gemini-api/docs/live-api/best-practices |

---

*Last updated from docs: March 2026*  
*Built for: Rekvin — Gemini Live Agent Challenge*
