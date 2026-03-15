# Audio System Fix - Voice Consistency & Mic Pause

## Problems Fixed

### 1. Voice Inconsistency
**Issue**: Different voices were used across Live API, Gemini TTS, and thought playback.

**Solution**: 
- Standardized voice extraction across all components
- Single source of truth: `voiceName` extracted once at test start
- Consistent priority: `persona.data.voiceName` → `persona.voiceName` → `'Puck'`

### 2. Audio Not Pausing When User Talks
**Issue**: Agent continued speaking when user activated microphone.

**Solution**:
- Pause PCM audio context when mic activates
- Stop TTS queue when mic activates
- Prevent new audio from scheduling while mic is active
- Resume audio when mic deactivates

## Audio Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PERSONA NODE                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ voiceName: "Charon" (detected or manually selected)  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TEST START (usePlaywrightAgent)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Extract voice ONCE: voiceName = "Charon"             │   │
│  │ Store in state: setPersonaVoice("Charon")            │   │
│  │ Send to backend with persona object                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Live API    │ │  Gemini TTS  │ │   Thoughts   │
    │  PCM Audio   │ │   Fallback   │ │    Audio     │
    │              │ │              │ │              │
    │ Voice:       │ │ Voice:       │ │ Voice:       │
    │ "Charon"     │ │ "Charon"     │ │ "Charon"     │
    └──────────────┘ └──────────────┘ └──────────────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                    ┌──────────────┐
                    │  MIC ACTIVE? │
                    └──────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                  YES              NO
                   │               │
            ┌──────┴──────┐       │
            │ PAUSE ALL   │       │
            │ AUDIO       │       │
            │ - Suspend   │       │
            │   PCM ctx   │       │
            │ - Stop TTS  │       │
            │ - Skip new  │       │
            │   chunks    │       │
            └─────────────┘       │
                                  ▼
                          ┌──────────────┐
                          │  PLAY AUDIO  │
                          └──────────────┘
```

## Code Changes

### 1. `usePlaywrightAgent.ts`

#### Voice Extraction
```typescript
const startTest = useCallback(async (targetUrl: string, persona: any, goal?: string) => {
    // Extract voice ONCE at start
    const voiceName = persona.data?.voiceName || persona.voiceName || 
                      persona.data?.voice_name || persona.voice_name || 'Puck';
    
    setPersonaVoice(voiceName);  // Store in state
    setPersonaContent(personaContentStr);
    
    // Send to backend
    await fetch('/api/test/start', {
        body: JSON.stringify({
            persona: {
                voiceName: voiceName,  // Consistent voice
                ...
            }
        })
    });
});
```

#### Mic Toggle with Audio Pause
```typescript
const toggleMic = useCallback(async () => {
    const newState = !isMicActive;
    
    if (newState) {
        // PAUSE ALL AUDIO
        stopTts();  // Stop TTS queue
        
        // Suspend PCM audio context
        if (outputAudioCtxRef.current?.state === 'running') {
            await outputAudioCtxRef.current.suspend();
        }
        
        setIsSpeaking(false);
    } else {
        // RESUME AUDIO
        if (outputAudioCtxRef.current?.state === 'suspended') {
            await outputAudioCtxRef.current.resume();
        }
    }
    
    setIsMicActive(newState);
    // ... rest of mic logic
}, [isMicActive, startMic, stopMic, stopTts]);
```

#### Prevent Audio During Mic Active
```typescript
const schedulePcmChunk = useCallback((base64: string) => {
    // Don't play if mic is active
    if (isMicActive) {
        console.log('[usePlaywrightAgent] Skipping PCM audio - mic is active');
        return;
    }
    
    // Don't schedule if context is suspended
    if (ctx.state === 'suspended') {
        return;
    }
    
    // ... schedule audio
}, [isMicActive]);

const playNextTts = useCallback(() => {
    // Don't play TTS if mic is active
    if (isMicActive) {
        console.log('[usePlaywrightAgent] Skipping TTS - mic is active');
        return;
    }
    // ... play TTS
}, [isMicActive]);
```

### 2. `TestingHub.tsx`

#### Thought Audio Pause
```typescript
const playThoughtAudio = async (text: string, voiceName: string, id: string, prompt?: string) => {
    // Don't play if mic is active
    if (testMode === 'playwright' && playwright.isMicActive) {
        console.log('[TestingHub] Skipping thought audio - mic is active');
        return;
    }
    
    // Use consistent voice
    await fetch('/api/tts', {
        body: JSON.stringify({ 
            text, 
            voiceName: voiceName || 'Puck',  // Same voice as Live API
            prompt: prompt || activePersona?.data?.content
        })
    });
};
```

### 3. `agent.ts` (Backend)

#### Consistent Voice Usage
```typescript
async function runLiveAgentLoop(sessionId: string, targetUrl: string, persona: any, goal?: string) {
    // Extract voice from persona object sent by frontend
    const voiceName = persona.voiceName || persona.voice_name || 'Puck';
    console.log(`[${sessionId}] Using voice: ${voiceName}`);
    
    // Configure Live API with same voice
    geminiWs.on('open', () => {
        const configMessage = {
            setup: {
                generationConfig: {
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName  // Same voice
                            }
                        }
                    }
                }
            }
        };
        geminiWs.send(JSON.stringify(configMessage));
    });
}
```

## Testing Checklist

### Voice Consistency
- [ ] Create persona → Check voice in node
- [ ] Start test → Check console: `[usePlaywrightAgent] Starting test with voice: Charon`
- [ ] Listen to Live API audio → Should match persona voice
- [ ] Click thought play button → Should match persona voice
- [ ] Check backend logs: `[sessionId] Using voice: Charon`
- [ ] Check TTS logs: `[TTS] Synthesizing with voice: Charon`

### Mic Pause Behavior
- [ ] Start test → Agent speaks
- [ ] Click "Talk to Agent" (mic button) → All audio stops immediately
- [ ] Verify console: `[usePlaywrightAgent] Mic activated - pausing all audio`
- [ ] Verify console: `[usePlaywrightAgent] Skipping PCM audio - mic is active`
- [ ] Speak to agent → No audio plays
- [ ] Turn off mic → Audio resumes
- [ ] Verify console: `[usePlaywrightAgent] Mic deactivated - resuming audio`

### Edge Cases
- [ ] Mic on → Click thought play button → Should not play
- [ ] Mic on → New PCM chunks arrive → Should not play
- [ ] Mic on → TTS queue has items → Should not play
- [ ] Mic off → All audio types resume correctly
- [ ] Switch between personas → Voice changes correctly

## Console Logs to Monitor

**Frontend (Browser Console):**
```
[usePlaywrightAgent] Starting test with voice: Charon for persona: Tech-Savvy Sarah
[usePlaywrightAgent] Mic activated - pausing all audio
[usePlaywrightAgent] Skipping PCM audio - mic is active
[usePlaywrightAgent] Skipping TTS - mic is active
[TestingHub] Skipping thought audio - mic is active
[usePlaywrightAgent] Mic deactivated - resuming audio
```

**Backend (Server Logs):**
```
[session-123] Using voice: Charon for persona: Tech-Savvy Sarah
[session-123] Configuring Live API with voice: Charon
[TTS] Synthesizing with voice: Charon (requested: Charon)
```

## Audio State Machine

```
┌─────────────┐
│    IDLE     │
└──────┬──────┘
       │ startTest()
       ▼
┌─────────────┐
│   PLAYING   │◄──────────┐
│  (isSpeaking│            │
│   = true)   │            │
└──────┬──────┘            │
       │                   │
       │ toggleMic(true)   │ toggleMic(false)
       ▼                   │
┌─────────────┐            │
│   PAUSED    │            │
│ (isMicActive│            │
│   = true)   │────────────┘
└──────┬──────┘
       │
       │ stopTest()
       ▼
┌─────────────┐
│    IDLE     │
└─────────────┘
```

## Voice Priority Order

1. **persona.data.voiceName** (from node editor)
2. **persona.voiceName** (from saved session)
3. **persona.data.voice_name** (legacy)
4. **persona.voice_name** (legacy)
5. **'Puck'** (default fallback)

## Default Voice Assignments

- **Female personas**: `Aoede`
- **Male personas**: `Charon`
- **Neutral/Unknown**: `Puck`
