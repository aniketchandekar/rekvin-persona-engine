# Gemini-TTS Reference Guide

> Google Cloud Text-to-Speech | [Official Docs](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)

Gemini-TTS is Google's latest Cloud TTS technology offering granular control over generated audio using natural-language prompts. It supports single and multi-speaker synthesis for content ranging from short snippets to long-form narratives, with control over style, accent, pace, tone, and emotional expression.

---

## Models

| Model ID | Best For | Multi-Speaker | Status |
|---|---|---|---|
| `gemini-2.5-flash-tts` | Low latency, cost-efficient everyday apps | ✅ Yes | GA |
| `gemini-2.5-flash-lite-preview-tts` | Low latency, cost-efficient single-speaker apps | ❌ No | Preview |
| `gemini-2.5-pro-tts` | High control — podcasts, audiobooks, customer support | ✅ Yes | GA |

### Supported Audio Formats

| Mode | Formats |
|---|---|
| **Unary** | `LINEAR16` (default), `ALAW`, `MULAW`, `MP3`, `OGG_OPUS`, `PCM` |
| **Streaming** | `PCM` (default), `ALAW`, `MULAW`, `OGG_OPUS` |

---

## Voices

30 available voices with distinct characteristics:

| Name | Gender | Name | Gender |
|---|---|---|---|
| Achernar | Female | Achird | Male |
| Algenib | Male | Algieba | Male |
| Alnilam | Male | Aoede | Female |
| Autonoe | Female | Callirrhoe | Female |
| Charon | Male | Despina | Female |
| Enceladus | Male | Erinome | Female |
| Fenrir | Male | Gacrux | Female |
| Iapetus | Male | Kore | Female |
| Laomedeia | Female | Leda | Female |
| Orus | Male | Pulcherrima | Female |
| Puck | Male | Rasalgethi | Male |
| Sadachbia | Male | Sadaltager | Male |
| Schedar | Male | Sulafat | Female |
| Umbriel | Male | Vindemiatrix | Female |
| Zephyr | Female | Zubenelgenubi | Male |

---

## Supported Languages (GA)

| Language | BCP-47 |
|---|---|
| Arabic (Egypt) | `ar-EG` |
| Bangla (Bangladesh) | `bn-BD` |
| Dutch (Netherlands) | `nl-NL` |
| English (India) | `en-IN` |
| English (United States) | `en-US` |
| French (France) | `fr-FR` |
| German (Germany) | `de-DE` |
| Hindi (India) | `hi-IN` |
| Indonesian (Indonesia) | `id-ID` |
| Italian (Italy) | `it-IT` |
| Japanese (Japan) | `ja-JP` |
| Korean (South Korea) | `ko-KR` |
| Marathi (India) | `mr-IN` |
| Polish (Poland) | `pl-PL` |
| Portuguese (Brazil) | `pt-BR` |
| Romanian (Romania) | `ro-RO` |
| Russian (Russia) | `ru-RU` |
| Spanish (Spain) | `es-ES` |
| Tamil (India) | `ta-IN` |
| Telugu (India) | `te-IN` |
| Thai (Thailand) | `th-TH` |
| Turkish (Turkey) | `tr-TR` |
| Ukrainian (Ukraine) | `uk-UA` |
| Vietnamese (Vietnam) | `vi-VN` |

> 80+ additional Preview languages available. See [full language list](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#available_languages).

---

## Limits

| Field | Limit |
|---|---|
| `text` field | ≤ 4,000 bytes |
| `prompt` field | ≤ 4,000 bytes |
| `text` + `prompt` combined | ≤ 8,000 bytes |
| `contents` field (Vertex AI) | ≤ 8,000 bytes |
| Max output audio duration | ~655 seconds (truncated if exceeded) |
| Speaker aliases | Alphanumeric, no whitespace |

---

## Choosing an API

### Use Cloud Text-to-Speech API if:
- You already use Chirp 3 HD or other existing voices and want minimal migration effort
- You need specific output audio encodings (Vertex AI outputs PCM 16-bit 24k only)
- You need multiple request / multiple response streaming

### Use Vertex AI API if:
- You're migrating from AI Studio or already using Vertex AI for other models
- You want to set the `temperature` parameter (`0.0`–`2.0`) to control output randomness
- You want a unified API structure across Google's generative models

---

## API Endpoints

### Cloud Text-to-Speech API

| Region | Endpoint |
|---|---|
| Global | `texttospeech.googleapis.com` |
| US | `us-texttospeech.googleapis.com` |
| EU | `eu-texttospeech.googleapis.com` |
| Canada | `northamerica-northeast1-texttospeech.googleapis.com` |

### Vertex AI API

| Region | Endpoint |
|---|---|
| Global | `aiplatform.googleapis.com` |
| `us-central1` | `us-central1-aiplatform.googleapis.com` |
| `europe-west1` | `europe-west1-aiplatform.googleapis.com` |
| Other regions | `<REGION>-aiplatform.googleapis.com` |

---

## Setup (Cloud Text-to-Speech API)

### Prerequisites

1. Enable the Cloud Text-to-Speech API in the Google Cloud Console
2. Enable billing on your project
3. Set up [Application Default Credentials](https://docs.cloud.google.com/text-to-speech/docs/authentication)
4. Grant `aiplatform.endpoints.predict` permission (via `roles/aiplatform.user`)
5. Install the Python client: `pip install google-cloud-texttospeech>=2.29.0`

### Configure Regional Endpoint

```python
import os
from google.cloud import texttospeech
from google.api_core.client_options import ClientOptions

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
TTS_LOCATION = os.getenv("GOOGLE_CLOUD_REGION")  # e.g. "us", "eu", or "global"

API_ENDPOINT = (
    f"{TTS_LOCATION}-texttospeech.googleapis.com"
    if TTS_LOCATION != "global"
    else "texttospeech.googleapis.com"
)

client = texttospeech.TextToSpeechClient(
    client_options=ClientOptions(api_endpoint=API_ENDPOINT)
)
```

---

## Cloud TTS API — Code Examples

### Single-Speaker Synthesis (Unary)

**Python** — requires `google-cloud-texttospeech >= 2.29.0`

```python
import os
from google.cloud import texttospeech

def synthesize(prompt: str, text: str, output_filepath: str = "output.mp3"):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text, prompt=prompt)

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="Charon",
        model_name="gemini-2.5-pro-tts"
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    with open(output_filepath, "wb") as out:
        out.write(response.audio_content)
        print(f"Audio content written to file: {output_filepath}")
```

**cURL**

```bash
PROJECT_ID=YOUR_PROJECT_ID
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "Say the following in a curious way",
      "text": "OK, so... tell me about this [uhm] AI thing."
    },
    "voice": {
      "languageCode": "en-us",
      "name": "Kore",
      "model_name": "gemini-2.5-flash-tts"
    },
    "audioConfig": {
      "audioEncoding": "LINEAR16"
    }
  }' \
  "https://texttospeech.googleapis.com/v1/text:synthesize" \
  | jq -r '.audioContent' | base64 -d | ffplay - -autoexit
```

---

### Single-Speaker Synthesis (Streaming)

Streaming returns audio in chunks as it's generated. The API uses **multiple request / multiple response** streaming. The `prompt` field must appear in the **first chunk only**. Synthesis begins when the client sends `Half-Close`.

**Python** — requires `google-cloud-texttospeech >= 2.29.0`

```python
import datetime
from google.cloud import texttospeech
import numpy as np

def synthesize(prompt: str, text_chunks: list[str], model: str, voice: str, locale: str):
    client = texttospeech.TextToSpeechClient()

    config_request = texttospeech.StreamingSynthesizeRequest(
        streaming_config=texttospeech.StreamingSynthesizeConfig(
            voice=texttospeech.VoiceSelectionParams(
                name=voice,
                language_code=locale,
                model_name=model
            )
        )
    )

    def request_generator():
        yield config_request
        for i, text in enumerate(text_chunks):
            yield texttospeech.StreamingSynthesizeRequest(
                input=texttospeech.StreamingSynthesisInput(
                    text=text,
                    prompt=prompt if i == 0 else None,
                )
            )

    streaming_responses = client.streaming_synthesize(request_generator())

    final_audio_data = np.array([])
    for response in streaming_responses:
        audio_data = np.frombuffer(response.audio_content, dtype=np.int16)
        final_audio_data = np.concatenate((final_audio_data, audio_data))

    return final_audio_data
```

---

### Multi-Speaker Synthesis — Freeform Input (Unary)

Use `\n` delimited `Speaker: text` lines. Speaker aliases must be alphanumeric with no whitespace.

**Python** — requires `google-cloud-texttospeech >= 2.31.0`

```python
from google.cloud import texttospeech

def synthesize_multispeaker_freeform(
    prompt: str,
    text: str,  # e.g. "Sam: Hi Bob!\nBob: Hi Sam!"
    output_filepath: str = "output.wav",
):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text, prompt=prompt)

    multi_speaker_voice_config = texttospeech.MultiSpeakerVoiceConfig(
        speaker_voice_configs=[
            texttospeech.MultispeakerPrebuiltVoice(speaker_alias="Sam", speaker_id="Kore"),
            texttospeech.MultispeakerPrebuiltVoice(speaker_alias="Bob", speaker_id="Charon"),
        ]
    )

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        model_name="gemini-2.5-pro-tts",
        multi_speaker_voice_config=multi_speaker_voice_config,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000,
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    with open(output_filepath, "wb") as out:
        out.write(response.audio_content)
```

**cURL** — requires `google-cloud-texttospeech >= 2.31.0`

```bash
PROJECT_ID=YOUR_PROJECT_ID
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "Say the following as a conversation between friends.",
      "text": "Sam: Hi Bob, how are you?\\nBob: I am doing well, and you?"
    },
    "voice": {
      "languageCode": "en-us",
      "modelName": "gemini-2.5-flash-tts",
      "multiSpeakerVoiceConfig": {
        "speakerVoiceConfigs": [
          { "speakerAlias": "Sam", "speakerId": "Kore" },
          { "speakerAlias": "Bob", "speakerId": "Charon" }
        ]
      }
    },
    "audioConfig": {
      "audioEncoding": "LINEAR16",
      "sampleRateHertz": 24000
    }
  }' \
  "https://texttospeech.googleapis.com/v1/text:synthesize" \
  | jq -r '.audioContent' | base64 -d | ffplay - -autoexit
```

---

### Multi-Speaker Synthesis — Structured Input (Unary)

Structured input (turn-based) enables intelligent verbalization — e.g. addresses and dates are spoken naturally rather than literally.

**Python** — requires `google-cloud-texttospeech >= 2.31.0`

```python
from google.cloud import texttospeech

def synthesize_multispeaker_structured(
    prompt: str,
    turns: list[texttospeech.MultiSpeakerMarkup.Turn],
    output_filepath: str = "output.wav",
):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(
        multi_speaker_markup=texttospeech.MultiSpeakerMarkup(turns=turns),
        prompt=prompt,
    )

    multi_speaker_voice_config = texttospeech.MultiSpeakerVoiceConfig(
        speaker_voice_configs=[
            texttospeech.MultispeakerPrebuiltVoice(speaker_alias="Speaker1", speaker_id="Kore"),
            texttospeech.MultispeakerPrebuiltVoice(speaker_alias="Speaker2", speaker_id="Charon"),
        ]
    )

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        model_name="gemini-2.5-pro-tts",
        multi_speaker_voice_config=multi_speaker_voice_config,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000,
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    with open(output_filepath, "wb") as out:
        out.write(response.audio_content)
```

**cURL**

```bash
PROJECT_ID=YOUR_PROJECT_ID
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "Say the following as a conversation between friends.",
      "multiSpeakerMarkup": {
        "turns": [
          { "speaker": "Sam", "text": "Hi Bob, how are you?" },
          { "speaker": "Bob", "text": "I am doing well, and you?" }
        ]
      }
    },
    "voice": {
      "languageCode": "en-us",
      "modelName": "gemini-2.5-flash-tts",
      "multiSpeakerVoiceConfig": {
        "speakerVoiceConfigs": [
          { "speakerAlias": "Sam", "speakerId": "Kore" },
          { "speakerAlias": "Bob", "speakerId": "Charon" }
        ]
      }
    },
    "audioConfig": {
      "audioEncoding": "LINEAR16",
      "sampleRateHertz": 24000
    }
  }' \
  "https://texttospeech.googleapis.com/v1/text:synthesize" \
  | jq -r '.audioContent' | base64 -d | ffplay - -autoexit
```

---

## Vertex AI API — Code Examples

In Vertex AI API, the `prompt` and `text` are merged into a single `contents` field:

```
"Say the following in a curious way: OK, so... tell me about this AI thing."
```

### Setup

```python
from google import genai
from google.genai import types
import wave, os

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("GOOGLE_CLOUD_REGION", "global")

client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

def wave_file(filename, pcm, channels=1, rate=24000, sample_width=2):
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)
```

### Single-Speaker Synthesis (Unary)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-tts",
    contents="Say the following in a curious way: OK, so... tell me about this AI thing.",
    config=types.GenerateContentConfig(
        speech_config=types.SpeechConfig(
            language_code="en-in",
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
            )
        ),
        temperature=2.0,
    )
)

data = response.candidates[0].content.parts[0].inline_data.data
wave_file("output_speech.wav", data)
```

**cURL**

```bash
PROJECT_ID=YOUR_PROJECT_ID
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": {
      "role": "user",
      "parts": { "text": "Say the following in a curious way: OK, so... tell me about this AI thing." }
    },
    "generation_config": {
      "speech_config": {
        "language_code": "en-in",
        "voice_config": {
          "prebuilt_voice_config": { "voice_name": "kore" }
        }
      },
      "temperature": 2.0
    }
  }' \
  https://aiplatform.googleapis.com/v1beta1/projects/$PROJECT_ID/locations/us-central1/publishers/google/models/gemini-2.5-flash-tts:generateContent \
  | jq -r '.candidates[0].content.parts[0].inlineData.data' \
  | base64 -d | ffmpeg -f s16le -ar 24k -ac 1 -i - output_speech.wav
```

---

### Single-Speaker Synthesis (Streaming)

Vertex AI uses **unidirectional streaming** (single request, stream of responses).

```python
for chunk in client.models.generate_content_stream(
    model="gemini-2.5-flash-tts",
    contents=text,
    config=generate_content_config,
):
    if chunk.candidates and chunk.candidates[0].content.parts:
        part = chunk.candidates[0].content.parts[0]
        if part.inline_data and part.inline_data.data:
            final_audio_data += part.inline_data.data
```

---

### Multi-Speaker Synthesis (Unary)

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-tts",
    contents="TTS the following conversation between Joe and Jane:\nJoe: How's it going?\nJane: Not too bad!",
    config=types.GenerateContentConfig(
        speech_config=types.SpeechConfig(
            language_code="en-in",
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Joe",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        )
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="Jane",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                        )
                    ),
                ]
            )
        ),
        temperature=2.0,
    )
)

data = response.candidates[0].content.parts[0].inline_data.data
wave_file("output_speech.wav", data)
```

---

## Relaxing Safety Filters

You can lower the content safety threshold via `AdvancedVoiceOptions` (requires `google-cloud-texttospeech >= 2.32.0`).

**Python**

```python
request = texttospeech.SynthesizeSpeechRequest(
    input=synthesis_input,
    voice=voice,
    audio_config=audio_config,
    advanced_voice_options=texttospeech.AdvancedVoiceOptions(
        relax_safety_filters=True,
    ),
)
response = client.synthesize_speech(request=request)
```

**cURL**

```bash
-d '{
  ...
  "advancedVoiceOptions": {
    "relaxSafetyFilters": true
  }
}'
```

---

## Prompting Guide

### The Three Levers of Speech Control

For predictable, high-quality output, align all three simultaneously:

| Lever | Role | Example |
|---|---|---|
| **Style Prompt** | Sets overall tone and emotional delivery | `"Speak in a calm, authoritative documentary tone."` |
| **Text Content** | Semantic meaning — should match the intended tone | Scared tone → `"I think someone is in the house."` |
| **Markup Tags** | Localized actions and style modifications | `[sigh]`, `[extremely fast]`, `[whispering]` |

### Markup Tag Reference (Preview)

#### Non-Speech Sounds (tag replaced by sound)

| Tag | Effect |
|---|---|
| `[sigh]` | Inserts a sigh |
| `[laughing]` | Inserts a laugh (quality influenced by prompt) |
| `[uhm]` | Inserts a hesitation sound |

#### Style Modifiers (tag modifies delivery, not spoken)

| Tag | Effect |
|---|---|
| `[sarcasm]` | Applies sarcastic tone to subsequent phrase |
| `[robotic]` | Makes speech sound robotic |
| `[shouting]` | Increases volume |
| `[whispering]` | Decreases volume |
| `[extremely fast]` | Speeds up delivery — ideal for disclaimers |

#### Vocalized Markup — Adjectives (tag is *spoken* as a word)

> ⚠️ These tags are spoken aloud. Prefer using the style prompt for emotional tones instead.

| Tag | Effect |
|---|---|
| `[scared]` | Word "scared" is spoken; sentence adopts scared tone |
| `[curious]` | Word "curious" is spoken; sentence adopts curious tone |
| `[bored]` | Word "bored" is spoken; sentence adopts monotone delivery |

#### Pacing & Pauses

| Tag | Duration |
|---|---|
| `[short pause]` | ~250ms |
| `[medium pause]` | ~500ms |
| `[long pause]` | ~1000ms+ |

### Prompting Best Practices

- **Align all three levers** — prompt, text, and tags should all point toward the same goal
- **Use emotionally rich text** — don't rely on tags alone; give the model meaningful content to work with
- **Write specific prompts** — `"React with an amused laugh"` outperforms just `[laughing]`
- **Test unfamiliar tags** — a tag's behavior isn't always predictable; verify before deploying to production
- **Don't rely on a single lever** — neutral text with an emotional prompt will yield weaker results than emotionally consistent text + prompt combinations

---

## Package Version Requirements

| Feature | Minimum Version |
|---|---|
| Single-speaker synthesis | `google-cloud-texttospeech >= 2.29.0` |
| Multi-speaker synthesis | `google-cloud-texttospeech >= 2.31.0` |
| Relax safety filters | `google-cloud-texttospeech >= 2.32.0` |

```bash
pip install "google-cloud-texttospeech>=2.32.0"
```

---

*Last updated: March 2026 | Source: [Google Cloud Documentation](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)*
