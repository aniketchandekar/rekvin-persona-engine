# Gemini Model Garden Reference Guide
### Gemini 3.1 Models & Gemini 2.5 Live API on Vertex AI

> **Last updated:** March 2026 | **Source:** [Google Cloud Vertex AI Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Gemini 3.1 Models in Model Garden](#3-gemini-31-models-in-model-garden)
4. [Quickstart: Your First Request](#4-quickstart-your-first-request)
5. [Thinking Levels (Core Concept)](#5-thinking-levels-core-concept)
6. [Media Resolution Control](#6-media-resolution-control)
7. [Thought Signatures](#7-thought-signatures)
8. [Multimodal Function Responses](#8-multimodal-function-responses)
9. [Streaming Function Calling](#9-streaming-function-calling)
10. [OpenAI Compatibility Layer](#10-openai-compatibility-layer)
11. [Gemini 2.5 Live API](#11-gemini-25-live-api)
12. [Live API: Getting Started](#12-live-api-getting-started)
13. [Supported Features Matrix](#13-supported-features-matrix)
14. [Prompting Best Practices](#14-prompting-best-practices)
15. [Migration Considerations](#15-migration-considerations)
16. [FAQ](#16-faq)
17. [Key Links & Resources](#17-key-links--resources)

---

## 1. Overview

**Gemini 3** is Google's most intelligent model family, built on state-of-the-art reasoning. It is designed to master agentic workflows, autonomous coding, and complex multimodal tasks.

**Gemini 2.5 Live API** enables low-latency, real-time voice and video interactions — processing continuous streams of audio, video, or text to deliver immediate, human-like spoken responses.

Both are available through **Vertex AI Model Garden** on Google Cloud.

---

## 2. Prerequisites & Setup

### Requirements

- A Google Cloud project with billing enabled
- Vertex AI API enabled
- Authentication via API key or Application Default Credentials (ADC)
- **Gen AI SDK for Python version 1.51.0 or later**

### Install the SDK

```bash
pip install --upgrade google-genai
```

### Set Environment Variables

> ⚠️ **Important:** Gemini 3.1 Pro Preview (`gemini-3.1-pro-preview`) and Gemini 3 Flash Preview (`gemini-3-flash-preview`) are only available on the **`global`** endpoint.

```bash
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
export GOOGLE_CLOUD_LOCATION=global
export GOOGLE_GENAI_USE_VERTEXAI=True
```

---

## 3. Gemini 3.1 Models in Model Garden

The Gemini 3.x family available in Model Garden:

| Model | Model ID | Tier | Notes |
|---|---|---|---|
| Gemini 3.1 Pro | `gemini-3.1-pro-preview` | Pro | Flagship reasoning model |
| Gemini 3 Pro | `gemini-3-pro-preview` | Pro | Previous Pro generation |
| Gemini 3 Pro Image | `gemini-3-pro-image-preview` | Pro | Image output support |
| Gemini 3.1 Flash Image | `gemini-3-1-flash-image-preview` | Flash | Image output + speed |
| Gemini 3 Flash | `gemini-3-flash-preview` | Flash | Speed-optimized |
| Gemini 3.1 Flash-Lite | `gemini-3-1-flash-lite-preview` | Flash-Lite | Cost/throughput optimized |

### Key Specifications (Gemini 3.1 Pro)

| Spec | Value |
|---|---|
| Context window (input) | 1,000,000 tokens |
| Max output tokens | 64,000 tokens |
| Knowledge cutoff | January 2025 |
| Available regions | `global` only |
| Image output support | ❌ No |
| Live API support | ❌ No |
| Temperature range | 0.0 – 2.0 (default: **1.0**) |

---

## 4. Quickstart: Your First Request

### Fast, Low-Latency Response

Use `thinking_level=LOW` for high-throughput tasks where speed matters most:

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="How does AI work?",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level=types.ThinkingLevel.LOW
        )
    ),
)
print(response.text)
```

### High-Reasoning, Complex Task

Use `thinking_level=HIGH` for multi-step planning, verified code generation, or deep tool use:

```python
from google import genai
from google.genai import types

client = genai.Client()

prompt = "Analyze the time complexity of QuickSort and compare it to MergeSort."

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level=types.ThinkingLevel.HIGH
        )
    ),
)
print(response.text)
```

---

## 5. Thinking Levels (Core Concept)

Gemini 3 uses **dynamic thinking** — an internal reasoning process before generating a response. The `thinking_level` parameter lets you control the depth of this reasoning to balance quality, latency, and cost.

### Thinking Level Reference

| Level | Models Supported | Use Case | Notes |
|---|---|---|---|
| `MINIMAL` | Gemini 3 Flash, Gemini 3.1 Flash-Lite only | Near-zero thinking budget, throughput-optimized | Still requires thought signatures |
| `LOW` | All Gemini 3 models | Simple tasks, high-throughput, speed essential | Fewer reasoning tokens |
| `MEDIUM` | Gemini 3 Flash, Gemini 3.1 Pro, Gemini 3.1 Flash-Lite | Moderate complexity, balanced speed/reasoning | — |
| `HIGH` | All Gemini 3 models | Complex reasoning, multi-step planning, advanced tool use | **Default for all Gemini 3 models** |

> ⚠️ You **cannot** combine `thinking_level` and the legacy `thinking_budget` parameter in the same request — this returns a `400` error.

### Example

```python
config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(
        thinking_level=types.ThinkingLevel.HIGH  # or LOW, MEDIUM, MINIMAL
    )
)
```

---

## 6. Media Resolution Control

Gemini 3 introduces the `media_resolution` parameter to give granular control over how many tokens are used to represent images, PDFs, and video frames.

### Token Count by Resolution

| Resolution | Image Tokens | Video Tokens (per frame) | PDF Tokens |
|---|---|---|---|
| `UNSPECIFIED` (Default) | 1,120 | 70 | 560 |
| `LOW` | 280 | 70 | 280 + Text |
| `MEDIUM` | 560 | 70 | 560 + Text |
| `HIGH` | 1,120 | 280 | 1,120 + Text |
| `ULTRA_HIGH` | 2,240 | N/A | N/A |

> **Note:** `ULTRA_HIGH` can only be set on **individual media parts**, not globally.

### Guidance

| Resolution | Best For |
|---|---|
| `ultra_high` | Fine-detail analysis: screen recordings, high-res photos |
| `high` | Standard image analysis for maximum quality |
| `medium` | Balanced quality/cost |
| `low` | Most tasks; video optimization |

### Setting Resolution Per-Part (Recommended for mixed content)

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=[
        types.Part(
            file_data=types.FileData(
                file_uri="gs://your-bucket/image.png",
                mime_type="image/jpeg",
            ),
            media_resolution=types.PartMediaResolution(
                level=types.PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH
            ),
        ),
        types.Part(
            file_data=types.FileData(
                file_uri="gs://your-bucket/video.mp4",
                mime_type="video/mp4",
            ),
            media_resolution=types.PartMediaResolution(
                level=types.PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW
            ),
        ),
        "Describe what you see in the image and video.",
    ],
)
print(response.text)
```

### Setting Resolution Globally

```python
response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=[
        types.Part(
            file_data=types.FileData(
                file_uri="gs://your-bucket/image.png",
                mime_type="image/jpeg",
            ),
        ),
        "What is in the image?",
    ],
    config=types.GenerateContentConfig(
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
    ),
)
```

> ⚠️ Token counts from `count_tokens` are **estimates**. Actual billing usage is only reflected in `response.usage_metadata` after execution.

---

## 7. Thought Signatures

Thought signatures are **encrypted tokens** that preserve the model's internal reasoning state across multi-turn conversations involving function/tool calls.

### Why They Matter

When Gemini calls a tool, it pauses its reasoning. The thought signature acts as a "save state" so the model can seamlessly resume context when you return the tool result. Without them, the model loses its reasoning chain.

### Key Rules

- Model responses **with** a function call always return a thought signature (even at `MINIMAL` thinking level)
- For **parallel** function calls, only the **first** call part carries the signature
- For **sequential** (multi-step) function calls, each call has its own signature — all must be passed back
- Model responses **without** a function call return the signature in the **last part** of the response
- Missing a required signature returns a `400` error

### Automated Handling (Recommended)

Using the Google Gen AI SDK, thought signatures are handled **automatically** when you append the full model response to history:

```python
from google import genai
from google.genai import types

client = genai.Client()

# Define your tool
get_weather_declaration = types.FunctionDeclaration(
    name="get_weather",
    description="Gets the current weather for a given location.",
    parameters={
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"],
    },
)
tool = types.Tool(function_declarations=[get_weather_declaration])

# Initial request
prompt = "What's the weather like in London?"
response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        tools=[tool],
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    ),
)

# Handle the function call
function_call = response.function_calls[0]
mock_result = {"location": "London", "temperature": "15C", "condition": "Cloudy"}

# Build history — signature is preserved automatically in response.candidates[0].content
history = [
    types.Content(role="user", parts=[types.Part(text=prompt)]),
    response.candidates[0].content,  # ← Thought signature preserved here
    types.Content(
        role="user",
        parts=[
            types.Part.from_function_response(
                name=function_call.name,
                response=mock_result,
            )
        ],
    )
]

# Final response
response_2 = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=history,
    config=types.GenerateContentConfig(
        tools=[tool],
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    ),
)
print(response_2.text)
```

### Automatic Function Calling (Simplest Approach)

The SDK handles everything — just pass Python functions directly:

```python
def get_current_temperature(location: str) -> dict:
    """Gets the current temperature for a given location."""
    return {"temperature": 25, "unit": "Celsius"}

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="What's the temperature in Boston?",
    config=types.GenerateContentConfig(
        tools=[get_current_temperature],
    )
)
print(response.text)
```

---

## 8. Multimodal Function Responses

Gemini 3 supports returning **images and files** as part of function responses — not just text. This allows the model to reason visually over tool outputs.

```python
from google import genai
from google.genai import types

client = genai.Client()

# Define tool
get_image_declaration = types.FunctionDeclaration(
    name="get_image",
    description="Retrieves the image for a specific order item.",
    parameters={
        "type": "object",
        "properties": {
            "item_name": {"type": "string", "description": "The ordered item name."}
        },
        "required": ["item_name"],
    },
)
tool_config = types.Tool(function_declarations=[get_image_declaration])

# Initial request
prompt = "Show me the blue jacket I ordered."
response_1 = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(tools=[tool_config]),
)

function_call = response_1.function_calls[0]

# Prepare multimodal function response (image + metadata)
function_response_data = {"image_ref": {"$ref": "blue_jacket.jpg"}}
function_response_multimodal = types.FunctionResponsePart(
    file_data=types.FunctionResponseFileData(
        mime_type="image/png",
        display_name="blue_jacket.jpg",
        file_uri="gs://your-bucket/blue_jacket.jpg",
    )
)

# Send result back with image
history = [
    types.Content(role="user", parts=[types.Part(text=prompt)]),
    response_1.candidates[0].content,
    types.Content(
        role="user",
        parts=[
            types.Part.from_function_response(
                name=function_call.name,
                response=function_response_data,
                parts=[function_response_multimodal]
            )
        ],
    )
]

response_2 = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=history,
    config=types.GenerateContentConfig(tools=[tool_config]),
)
print(response_2.text)
```

---

## 9. Streaming Function Calling

Enable streaming partial function call arguments for improved real-time tool use experience by setting `stream_function_call_arguments=True`:

```python
from google import genai
from google.genai import types

client = genai.Client()

get_weather_tool = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="get_weather",
        description="Gets current weather for a location.",
        parameters={
            "type": "object",
            "properties": {"location": {"type": "string"}},
            "required": ["location"],
        },
    )
])

for chunk in client.models.generate_content_stream(
    model="gemini-3.1-pro-preview",
    contents="What's the weather in London and New York?",
    config=types.GenerateContentConfig(
        tools=[get_weather_tool],
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode=types.FunctionCallingConfigMode.AUTO,
                stream_function_call_arguments=True,  # ← Enable streaming args
            )
        ),
    ),
):
    if chunk.function_calls:
        function_call = chunk.function_calls[0]
        if function_call and function_call.name:
            print(f"Tool: {function_call.name}")
            print(f"will_continue={function_call.will_continue}")
```

---

## 10. OpenAI Compatibility Layer

Gemini 3 models can be called using the OpenAI Python library via Vertex AI's OpenAI-compatible endpoint.

### Mapping

| OpenAI Parameter | Gemini Equivalent |
|---|---|
| `reasoning_effort="none"` | `thinking_level=MINIMAL` (Flash only) |
| `reasoning_effort="medium"` | `thinking_level=MEDIUM` |
| `reasoning_effort="high"` | `thinking_level=HIGH` |

### Example

```python
import openai
from google.auth import default
from google.auth.transport.requests import Request

credentials, _ = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
credentials.refresh(Request())

client = openai.OpenAI(
    base_url=f"https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/global/endpoints/openapi",
    api_key=credentials.token,
)

response = client.chat.completions.create(
    model="gemini-3.1-pro-preview",
    reasoning_effort="medium",
    messages=[{"role": "user", "content": "Explain the CAP theorem."}],
)
print(response.choices[0].message.content)
```

### OpenAI + Thought Signatures (Tool Use)

Thought signatures are handled automatically when you append the full response to the messages list:

```python
# After first response with tool call:
messages.append(response1.choices[0].message)  # ← Signature preserved here

# Add tool result
messages.append({
    "role": "user",
    "tool_call_id": tool_call.id,
    "content": json.dumps(tool_result),
})

# Continue conversation
response2 = client.chat.completions.create(
    model="gemini-3.1-pro-preview",
    messages=messages,
    tools=tools,
    extra_body={
        "extra_body": {
            "google": {"thinking_config": {"include_thoughts": True}},
        },
    },
)
```

---

## 11. Gemini 2.5 Live API

The **Gemini Live API** enables real-time, low-latency voice and video conversations with Gemini. It uses a stateful WebSocket connection and processes continuous streams for immediate, human-like spoken responses.

### Use Cases

- **E-commerce:** Shopping assistants, real-time customer support
- **Gaming:** Interactive NPCs, in-game help assistants, real-time translation
- **Healthcare:** Health companions, patient support and education
- **Financial services:** AI advisors for wealth management
- **Education:** AI mentors and personalized tutoring
- **Next-gen interfaces:** Robotics, smart glasses, vehicles

### Technical Specifications

| Category | Details |
|---|---|
| Input modalities | Audio (raw 16-bit PCM, 16kHz, little-endian), Images/Video (JPEG, 1FPS), Text |
| Output modalities | Audio (raw 16-bit PCM, 24kHz, little-endian), Text |
| Protocol | Stateful WebSocket connection (WSS) |

### Supported Live Models

| Model ID | Status | Use Case |
|---|---|---|
| `gemini-live-2.5-flash-native-audio` | **Generally Available** ✅ | Recommended. Low-latency voice agents with multilingual support. |
| `gemini-live-2.5-flash-preview-native-audio-09-2025` | Public Preview ⚠️ | **Deprecated March 19, 2026** — migrate to GA model above. |

### Key Features

| Feature | Description |
|---|---|
| **Native audio** | High-quality, realistic speech across 24 languages |
| **Multilingual switching** | Seamlessly switch languages mid-conversation |
| **Barge-in** | Users can interrupt the model at any time |
| **Affective dialog** | Adapts tone and style to user's emotional expression |
| **Tool use** | Function calling, Google Search integration |
| **Audio transcriptions** | Text transcripts of user input and model output |
| **Proactive audio** (Preview) | Control when and in what context the model responds |
| **Voice Activity Detection** | Automatic detection of when the user is speaking |

---

## 12. Live API: Getting Started

### Option 1: Gen AI SDK (Recommended)

Best for Python backends with ease-of-use priority.

```python
# Install
pip install --upgrade google-genai

# Set environment
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
export GOOGLE_CLOUD_LOCATION=us-central1  # Live API uses regional endpoints
export GOOGLE_GENAI_USE_VERTEXAI=True
```

```python
import asyncio
from google import genai

client = genai.Client()

async def live_session():
    async with client.aio.live.connect(
        model="gemini-live-2.5-flash-native-audio",
        config={
            "response_modalities": ["AUDIO"],
        }
    ) as session:
        # Send a text message
        await session.send(input="Hello! Can you hear me?", end_of_turn=True)
        
        # Receive responses
        async for response in session.receive():
            if response.data:
                # response.data contains raw PCM audio bytes
                print(f"Received audio chunk: {len(response.data)} bytes")
            if response.text:
                print(f"Model said: {response.text}")

asyncio.run(live_session())
```

### Option 2: WebSockets (Raw Protocol Control)

Best for JavaScript frontends and when you need direct protocol access.

```javascript
// Browser/Node.js WebSocket connection
const ws = new WebSocket(
  `wss://REGION-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`
);

ws.onopen = () => {
  // Send setup message first
  ws.send(JSON.stringify({
    setup: {
      model: "projects/PROJECT_ID/locations/REGION/publishers/google/models/gemini-live-2.5-flash-native-audio",
      generation_config: {
        response_modalities: ["AUDIO"]
      }
    }
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.serverContent?.modelTurn?.parts) {
    for (const part of response.serverContent.modelTurn.parts) {
      if (part.inlineData) {
        // Handle audio: part.inlineData.data is base64 PCM
        const audioBytes = atob(part.inlineData.data);
        // Play audio...
      }
    }
  }
};
```

### Option 3: Agent Development Kit (ADK)

Best for agent-based architectures using Google's ADK framework.

```bash
pip install google-adk
```

```python
from google.adk.agents import LiveRequestQueue, Agent
from google.adk.runners import InMemoryRunner

# Define an agent with Live API capability
root_agent = Agent(
    name="voice_assistant",
    model="gemini-live-2.5-flash-native-audio",
    instruction="You are a helpful voice assistant.",
)

runner = InMemoryRunner(agent=root_agent, app_name="my_voice_app")
# Use runner.run_live() for real-time streaming sessions
```

### Enabling Audio Transcription

```python
config = {
    "response_modalities": ["AUDIO"],
    "output_audio_transcription": {},   # Transcribe model output
    "input_audio_transcription": {},    # Transcribe user input
}
```

### Partner Integrations (WebRTC)

These platforms have pre-integrated Gemini Live API over WebRTC:

| Partner | Docs |
|---|---|
| Daily | https://www.daily.co/products/gemini/multimodal-live-api/ |
| LiveKit | https://docs.livekit.io/agents/integrations/google/ |
| Twilio | https://www.twilio.com/docs |
| Voximplant | https://voximplant.com/products/gemini-client |

---

## 13. Supported Features Matrix

### Gemini 3.1 Pro

| Feature | Supported |
|---|---|
| System instructions | ✅ |
| Structured output | ✅ |
| Function calling | ✅ |
| Streaming function calling | ✅ |
| Multimodal function responses | ✅ |
| Grounding with Google Search | ✅ |
| Code execution | ✅ |
| URL Context | ✅ |
| Thinking / Thought signatures | ✅ |
| Context caching | ✅ |
| Count tokens | ✅ |
| Chat completions (OpenAI compat) | ✅ |
| Batch prediction | ✅ |
| Provisioned Throughput | ✅ |
| Image generation/output | ❌ |
| Live API | ❌ |
| Image segmentation | ❌ |

### Gemini 2.5 Live API Model

| Feature | Supported |
|---|---|
| Real-time audio I/O | ✅ |
| Real-time video input | ✅ |
| Text I/O | ✅ |
| Barge-in / interruption | ✅ |
| 24-language support | ✅ |
| Affective dialog | ✅ |
| Function calling / tool use | ✅ |
| Google Search grounding | ✅ |
| Audio transcription | ✅ |
| Voice Activity Detection | ✅ |
| Proactive audio | ✅ (Preview) |
| Context caching | ❌ |
| Batch prediction | ❌ |

---

## 14. Prompting Best Practices

### For Gemini 3.1 (Text/Reasoning)

**Be concise and direct.** Gemini 3 performs best with clear, direct instructions rather than verbose prompt engineering techniques designed for older models.

**Control output verbosity.** By default, Gemini 3 prefers efficient, direct answers. For conversational or "chatty" output, explicitly request it:
> *"Explain this as a friendly, talkative assistant."*

**Grounding instructions.** When using context-grounded generation, use this system instruction to prevent hallucination:
```
You are a strictly grounded assistant limited to the information provided in
the User Context. In your answers, rely ONLY on the facts directly mentioned
in that context. Do not assume or infer; simply report them exactly as they
appear. If the exact answer is not explicitly written in the context, state
that the information is not available.
```

**Fix Google Search date confusion (Gemini 3 Flash).** Add to system instructions when using the Google Search tool:
```
For time-sensitive queries, you MUST follow the provided current time when
formulating search queries. Remember it is 2026 this year.
```

**Set knowledge cutoff explicitly** when Search is disabled and currency matters:
```
Your knowledge cutoff date is January 2025.
```

**Temperature.** Keep at the default value of **`1.0`**. Setting it lower (especially for deterministic outputs) can cause looping or degraded performance on complex tasks.

**Media resolution.** Use `HIGH` or `ULTRA_HIGH` for dense documents, fine-detail images, or screen recordings. Use `LOW` for video or content with less visual detail to save tokens/cost.

**Video analysis.** For fast-motion or high-speed content, use a higher FPS sampling rate for better temporal granularity.

### For Gemini 2.5 Live API

- Design for **turn-based natural conversation** — the model handles barge-in, so don't try to manage it manually
- Use **system instructions** to define the agent's persona, language, and boundaries at session start
- Enable **affective dialog** for interactions where emotional responsiveness matters
- Enable **audio transcriptions** if you need to log or display conversations as text
- Keep sessions alive with heartbeat messages for long-running agents
- Use **proactive audio** (Preview) to control when the model speaks first vs. waits

---

## 15. Migration Considerations

When migrating from Gemini 2.x to Gemini 3.x:

| Area | Action Required |
|---|---|
| **Thinking parameter** | Replace `thinking_budget` with `thinking_level`. Using both returns a `400` error. |
| **Temperature** | Remove explicit `temperature` settings or reset to `1.0`. Low values can degrade reasoning. |
| **Thought signatures** | Now **required** in multi-turn tool use — missing signatures cause `400` errors (previously just warnings). |
| **Media tokenization** | Gemini 3 uses variable sequence length instead of Pan and Scan. Token costs differ. |
| **Token counts** | `count_tokens` returns **estimates** for multimodal inputs. Actual billing is in `usage_metadata`. |
| **Token consumption** | Images/PDFs may use **more** tokens. Video may use **fewer** tokens at new defaults. |
| **PDF modality reporting** | PDF token counts now appear under `IMAGE` modality in `usage_metadata`, not `DOCUMENT`. |
| **Image segmentation** | **Not supported** in Gemini 3. Continue using Gemini 2.5 Flash (thinking disabled) for these workloads. |

---

## 16. FAQ

**Q: What is the knowledge cutoff for Gemini 3?**
A: January 2025.

**Q: Which region is `gemini-3.1-pro-preview` available on?**
A: Global (`global`) endpoint only.

**Q: What are the context window limits?**
A: 1 million token input, up to 64k tokens of output.

**Q: Does `gemini-3.1-pro-preview` support image output?**
A: No. Use Gemini 3 Pro Image (`gemini-3-pro-image`) for image generation.

**Q: Does `gemini-3.1-pro-preview` support the Live API?**
A: No. Use `gemini-live-2.5-flash-native-audio` for real-time audio/video.

**Q: The old `gemini-live-2.5-flash-preview-native-audio-09-2025` model — is it still usable?**
A: It is currently in Public Preview but will be **deprecated and removed on March 19, 2026**. Migrate to `gemini-live-2.5-flash-native-audio` immediately.

**Q: Can I use both `thinking_level` and `thinking_budget` together?**
A: No. Using both in the same request returns a `400` error.

**Q: Why do my token count estimates not match billing?**
A: `count_tokens` returns estimates for multimodal inputs based on `media_resolution`. Actual consumed tokens are only available in `response.usage_metadata` after generation.

**Q: When should I use Gemini 3 Flash vs. Gemini 3.1 Pro?**
A: Use **Flash** for high-throughput, cost-sensitive, or speed-critical workloads. Use **3.1 Pro** for tasks requiring the highest reasoning quality, complex multi-step planning, or advanced agentic behavior.

---

## 17. Key Links & Resources

| Resource | URL |
|---|---|
| Gemini 3 Getting Started | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3 |
| Gemini 3 Prompting Guide | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide |
| Live API Overview | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api |
| Live API SDK Tutorial | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-sdk |
| Live API WebSocket Tutorial | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-websocket |
| Live API ADK Tutorial | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-adk |
| Gemini 3.1 Pro Model Card | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro |
| Gemini 2.5 Flash Live API Model Card | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api |
| Thinking & Thought Signatures | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking |
| Function Calling Guide | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling |
| Model Garden (Console) | https://console.cloud.google.com/vertex-ai/model-garden |
| Vertex AI Studio — Live API | https://console.cloud.google.com/vertex-ai/studio/multimodal-live |
| Intro to Gemini 3.1 Pro (Colab) | https://colab.research.google.com/github/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_3_1_pro.ipynb |
| Vertex AI Pricing | https://cloud.google.com/vertex-ai/generative-ai/pricing |

---

*This guide was compiled from official Google Cloud documentation. For the most up-to-date information, always refer to the official docs linked above.*
