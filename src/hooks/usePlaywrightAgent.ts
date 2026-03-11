import { useState, useRef, useCallback } from 'react';
import type { AgentThought, AgentScreenshot, AgentAnalysis } from '../types';

export function usePlaywrightAgent() {
    const [status, setStatus] = useState<'idle' | 'running' | 'analyzing' | 'completed' | 'error'>('idle');
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [screenshots, setScreenshots] = useState<AgentScreenshot[]>([]);
    const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
    const [currentUrl, setCurrentUrl] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isMicActive, setIsMicActive] = useState<boolean>(false);
    const [userTranscript, setUserTranscript] = useState<string>('');
    const [agentTranscript, setAgentTranscript] = useState<string>('');

    const sessionIdRef = useRef<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    // Output audio: continuous Web Audio API scheduler
    const outputAudioCtxRef = useRef<AudioContext | null>(null);
    const nextPlayTimeRef = useRef<number>(0);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletRef = useRef<ScriptProcessorNode | null>(null);
    // TTS fallback: tracks if real PCM audio has been received this session
    const hasPcmAudioRef = useRef<boolean>(false);
    // TTS speech queue for reliable, non-overlapping speech
    const ttsSpeakingRef = useRef<boolean>(false);
    const ttsQueueRef = useRef<string[]>([]);
    const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Schedules a raw PCM base64 chunk (24kHz, 16-bit, mono) into a gapless audio stream
    const schedulePcmChunk = useCallback((base64: string) => {
        try {
            if (!outputAudioCtxRef.current) {
                outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
            }
            const ctx = outputAudioCtxRef.current;

            // Decode base64 -> binary -> Int16Array
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            // Int16 PCM -> Float32
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768.0;
            }

            // Create and schedule AudioBuffer back-to-back
            const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            // Schedule precisely after the previous chunk
            const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;

            setIsSpeaking(true);
            source.onended = () => {
                // Only clear speaking indicator when no more chunks are queued soon
                if (nextPlayTimeRef.current <= (outputAudioCtxRef.current?.currentTime ?? 0) + 0.1) {
                    setIsSpeaking(false);
                }
            };
        } catch (err) {
            console.error('Error scheduling PCM chunk:', err);
        }
    }, []);

    // ── TTS FALLBACK SPEECH ────────────────────────────────────────────────
    // Queue text to speak via browser SpeechSynthesis when PCM audio is unavailable
    const speakText = useCallback((text: string) => {
        if (!text || text.trim().length === 0) return;
        ttsQueueRef.current.push(text);
        processTtsQueue();
    }, []);

    const processTtsQueue = useCallback(() => {
        if (ttsSpeakingRef.current || ttsQueueRef.current.length === 0) return;
        const text = ttsQueueRef.current.shift();
        if (!text) return;

        ttsSpeakingRef.current = true;
        setIsSpeaking(true);

        const utterance = new SpeechSynthesisUtterance(text);
        ttsUtteranceRef.current = utterance;

        // Pick a natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('google') || (v.lang.startsWith('en') && !v.name.includes('compact')));
        if (preferred) utterance.voice = preferred;

        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
            ttsSpeakingRef.current = false;
            ttsUtteranceRef.current = null;
            if (ttsQueueRef.current.length > 0) {
                processTtsQueue();
            } else {
                setIsSpeaking(false);
            }
        };
        utterance.onerror = () => {
            ttsSpeakingRef.current = false;
            ttsUtteranceRef.current = null;
            processTtsQueue();
        };

        window.speechSynthesis.speak(utterance);
    }, []);

    const stopTts = useCallback(() => {
        window.speechSynthesis.cancel();
        ttsSpeakingRef.current = false;
        ttsQueueRef.current = [];
        ttsUtteranceRef.current = null;
        setIsSpeaking(false);
    }, []);

    // ── MICROPHONE CAPTURE ──────────────────────────────────────────
    const startMic = useCallback(async () => {
        if (!sessionIdRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });
            micStreamRef.current = stream;

            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);

            // Use ScriptProcessor for PCM extraction (widely supported)
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            audioWorkletRef.current = processor;

            const sessionId = sessionIdRef.current;

            processor.onaudioprocess = (e) => {
                if (!sessionIdRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);

                // Convert Float32 [-1,1] to Int16
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert to base64
                const uint8 = new Uint8Array(pcmData.buffer);
                let binary = '';
                for (let i = 0; i < uint8.length; i++) {
                    binary += String.fromCharCode(uint8[i]);
                }
                const base64 = btoa(binary);

                // Send to server
                fetch('/api/test/audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        audioData: base64
                    })
                }).catch(() => { /* Silently fail if server is busy */ });
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);

            setIsMicActive(true);
        } catch (err: any) {
            console.error('Mic access denied:', err);
            setError('Microphone access is required for voice intervention.');
        }
    }, []);

    const stopMic = useCallback(() => {
        if (audioWorkletRef.current) {
            audioWorkletRef.current.disconnect();
            audioWorkletRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        setIsMicActive(false);
    }, []);

    const toggleMic = useCallback(async () => {
        if (isMicActive) {
            stopMic();
        } else {
            await startMic();
        }
    }, [isMicActive, startMic, stopMic]);

    const startTest = useCallback(async (targetUrl: string, persona: any, goal?: string) => {
        // Reset
        setStatus('running');
        setThoughts([]);
        setScreenshots([]);
        setLatestScreenshot(null);
        setCurrentUrl('');
        setAnalysis(null);
        setError(null);
        setStatusMessage('Starting agent...');
        setUserTranscript('');
        setAgentTranscript('');

        const sessionId = `session-${Date.now()}`;
        sessionIdRef.current = sessionId;

        // ── AUDIO ── Eagerly initialize AudioContext on user interaction to bypass autoplay policies
        try {
            if (!outputAudioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                outputAudioCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
            }
            if (outputAudioCtxRef.current.state === 'suspended') {
                outputAudioCtxRef.current.resume();
            }
        } catch (err) {
            console.warn('Could not initialize AudioContext eagerly:', err);
        }

        // 1. Open SSE stream FIRST
        const evtSource = new EventSource(`/api/test/stream/${sessionId}`);
        eventSourceRef.current = evtSource;

        evtSource.addEventListener('status', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            setStatusMessage(data.message || '');
            if (data.status === 'completed' || data.status === 'done') {
                setStatus('completed');
            } else if (data.status === 'analyzing') {
                setStatus('analyzing');
            } else if (data.status === 'running') {
                setStatus('running');
            }
        });

        evtSource.addEventListener('screenshot', (e) => {
            const data: AgentScreenshot = JSON.parse((e as MessageEvent).data);
            setLatestScreenshot(data.image);
            setCurrentUrl(data.url);
            setScreenshots(prev => [...prev, data]);
        });

        evtSource.addEventListener('thought', (e) => {
            const data: AgentThought = JSON.parse((e as MessageEvent).data);
            setThoughts(prev => [...prev, data]);
        });

        evtSource.addEventListener('action_result', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            if (!data.success) {
                setThoughts(prev => {
                    if (prev.length === 0) return prev;
                    const updated = [...prev];
                    const last = { ...updated[updated.length - 1] };
                    last.thought = `${last.thought} ⚠️ Action failed: ${data.detail}`;
                    updated[updated.length - 1] = last;
                    return updated;
                });
            }
        });

        evtSource.addEventListener('analysis', (e) => {
            const data: AgentAnalysis = JSON.parse((e as MessageEvent).data);
            setAnalysis(data);
        });

        // ── AUDIO ── (raw PCM chunks → gapless Web Audio scheduler)
        evtSource.addEventListener('audio', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            if (data.audioBase64) {
                hasPcmAudioRef.current = true;
                schedulePcmChunk(data.audioBase64);
            }
        });

        // ── LIVE TRANSCRIPTIONS ──
        evtSource.addEventListener('user_transcript', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            setUserTranscript(data.text || '');
        });

        evtSource.addEventListener('agent_transcript', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            const text = data.text || '';
            setAgentTranscript(text);
            // Speak via TTS if no real PCM audio is being received
            if (text && !hasPcmAudioRef.current) {
                speakText(text);
            }
        });

        evtSource.addEventListener('error', (e) => {
            try {
                const data = JSON.parse((e as MessageEvent).data || '{}');
                setError(data.message || 'Unknown error');
            } catch {
                setError('Connection to agent server lost');
            }
            setStatus('error');
        });

        evtSource.onerror = () => {
            if (status === 'completed' || status === 'error') {
                evtSource.close();
            }
        };

        // 2. Start the agent on the backend
        try {
            const res = await fetch('/api/test/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    targetUrl,
                    goal,
                    persona: {
                        label: persona.data?.label || persona.label || 'Unknown Persona',
                        content: persona.data?.content || persona.content || '',
                        fields: persona.data?.fields || persona.fields || {},
                    },
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                setError(errData.error || 'Failed to start agent');
                setStatus('error');
                evtSource.close();
            }
        } catch (err: any) {
            setError(`Cannot reach agent server: ${err?.message}. Is the server running on port 3001?`);
            setStatus('error');
            evtSource.close();
        }
    }, []);

    const stopTest = useCallback(async () => {
        stopMic();
        stopTts();
        if (sessionIdRef.current) {
            try {
                await fetch('/api/test/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: sessionIdRef.current }),
                });
            } catch {
                // Server may already be down
            }
        }
        eventSourceRef.current?.close();
        setStatus('completed');
        setStatusMessage('Test stopped by user.');
    }, [stopMic, stopTts]);

    const reset = useCallback(() => {
        stopMic();
        stopTts();
        hasPcmAudioRef.current = false;
        // Stop and release the output AudioContext
        if (outputAudioCtxRef.current) {
            outputAudioCtxRef.current.close();
            outputAudioCtxRef.current = null;
            nextPlayTimeRef.current = 0;
        }
        eventSourceRef.current?.close();
        setStatus('idle');
        setThoughts([]);
        setScreenshots([]);
        setLatestScreenshot(null);
        setCurrentUrl('');
        setStatusMessage('');
        setAnalysis(null);
        setError(null);
        setUserTranscript('');
        setAgentTranscript('');
        sessionIdRef.current = null;
    }, [stopMic, stopTts]);

    return {
        status,
        thoughts,
        screenshots,
        latestScreenshot,
        currentUrl,
        statusMessage,
        analysis,
        error,
        isSpeaking,
        isMicActive,
        userTranscript,
        agentTranscript,
        startTest,
        stopTest,
        reset,
        toggleMic,
    };
}
