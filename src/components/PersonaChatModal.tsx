import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Mic, Play, Square, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/geminiService';

interface PersonaChatModalProps {
    persona: any;
    onClose: () => void;
    sessionData?: any;
}

export function PersonaChatModal({ persona, onClose, sessionData }: PersonaChatModalProps) {
    // Debug logging
    useEffect(() => {
        console.log('[PersonaChatModal] Mounted with:', { persona, sessionData });
    }, []);

    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
        { role: 'model', text: `Hi! I'm ${persona?.data?.label || 'Unknown'}. What would you like to ask me?` }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatSession, setChatSession] = useState<any>(null);

    // Audio state
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // STT state
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        const initChat = async () => {
            if (!persona?.data) {
                console.error('[PersonaChatModal] Invalid persona data:', persona);
                return;
            }

            let contextBlocks = '';
            if (sessionData) {
                contextBlocks += `\n\n--- RECENT TEST SESSION CONTEXT ---\n`;
                contextBlocks += `You recently completed a test session on this web app.\n`;
                if (sessionData.mode === 'playwright' && sessionData.agentThoughts) {
                    contextBlocks += `Here is your exact thought process and actions during the test:\n`;
                    sessionData.agentThoughts.forEach((t: any, i: number) => {
                        contextBlocks += `Step ${i + 1} [${t.action}]: ${t.thought}\n`;
                    });
                } else if (sessionData.mode === 'vision' && sessionData.narrations) {
                    contextBlocks += `Here is your exact narration during the test:\n`;
                    sessionData.narrations.forEach((n: any, i: number) => {
                        contextBlocks += `- ${n.text}\n`;
                    });
                }
                if (sessionData.analysis) {
                    contextBlocks += `\nYour overall analysis of the experience: Success Score: ${sessionData.analysis.metrics.successScore}%, Sentiment: ${sessionData.analysis.metrics.sentiment}.\n`;
                }
                contextBlocks += `\nThe user might ask you questions about this specific test session. Use the context above to explain your decisions, what you saw, and how you felt about the experience.\n-----------------------------------\n`;
            }

            const systemInstruction = `You are roleplaying as the following user persona:
Name/Label: ${persona.data.label || 'Unknown'}
Description: ${persona.data.content || 'No description provided'}
Traits: ${Object.entries(persona.data.fields || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ') || 'None specified'}

Rules:
1. Always stay in character. Speak in the first person ("I").
2. Your tone should match the traits described.
3. Keep responses relatively concise (2-4 sentences max).${contextBlocks}`;

            console.log('[PersonaChatModal] Initializing chat with system instruction:', systemInstruction);
            const session = geminiService.createChatbot(systemInstruction, 'gemini-2.5-flash');
            setChatSession(session);
        };
        initChat();

        // Init Speech Recognition if available
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let fullTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    fullTranscript += event.results[i][0].transcript;
                }
                setInput(fullTranscript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsRecording(false);
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [persona, sessionData]);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
        } else {
            setInput(''); // clear input when starting speech
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };

    const handleSend = async (textOveride?: string) => {
        const textToSend = textOveride || input;
        if (!textToSend.trim() || !chatSession || isTyping) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
        setIsTyping(true);

        // Stop current audio if playing
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }

        try {
            const response = await chatSession.sendMessage({ message: textToSend });
            const responseText = response.text;

            setMessages(prev => [...prev, { role: 'model', text: responseText }]);

            // Fetch TTS
            const voiceName = persona?.data?.voiceName || persona?.voiceName || 'Puck';
            const ttsRes = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: responseText, 
                    voiceName,
                    prompt: persona?.data?.content || persona?.content || ''
                })
            });

            if (ttsRes.ok) {
                const data = await ttsRes.json();
                if (data.audioBase64) {
                    playAudio(data.audioBase64);
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'model', text: '*(Communication error)*' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const playAudio = (base64Data: string) => {
        const audioUrl = `data:audio/mpeg;base64,${base64Data}`;
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);

        audio.play().catch(e => console.error('Audio play failed:', e));
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 md:p-12">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-4xl bg-ink-2/95 border border-rule-2 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-rule-2 bg-ink-3">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-node-persona/20 flex items-center justify-center relative">
                            <span className="text-node-persona font-display text-xl">{persona?.data?.label?.charAt(0) || '?'}</span>
                            {isPlaying && (
                                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-node-idea rounded-full animate-pulse border-2 border-ink-3"></span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-cream font-display text-lg tracking-wide">{persona?.data?.label || 'Unknown Persona'}</h2>
                            <div className="text-xs text-cream-dim flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-node-idea/50"></span>
                                Live Audio Session
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isPlaying && (
                            <button
                                onClick={stopAudio}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-node-tension/10 text-node-tension text-xs hover:bg-node-tension/20 transition-colors"
                            >
                                <Square size={12} fill="currentColor" />
                                Stop
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-cream-dim hover:text-cream rounded-full hover:bg-white/5 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    <AnimatePresence initial={false}>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-cream text-ink rounded-tr-sm'
                                        : 'bg-ink-3 border border-rule-2 text-cream-dim rounded-tl-sm'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </motion.div>
                        ))}

                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-start"
                            >
                                <div className="bg-ink-3 border border-rule-2 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cream-dim/50 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-cream-dim/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                    <span className="w-1.5 h-1.5 bg-cream-dim/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-ink-3 border-t border-rule-2">
                    <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
                        <div className="relative flex-1">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                disabled={isTyping || isRecording}
                                placeholder={isRecording ? 'Listening...' : "Message persona..."}
                                className="w-full bg-ink flex w-full rounded-xl border border-rule-2 px-4 py-3 text-sm text-cream placeholder-cream/30 focus:outline-none focus:border-cream/20 transition-colors disabled:opacity-50 resize-none min-h-[44px] max-h-32"
                                rows={1}
                            />
                        </div>

                        <button
                            onClick={toggleRecording}
                            disabled={isTyping || !recognitionRef.current}
                            className={`p-3 rounded-xl flex-shrink-0 transition-all ${isRecording
                                ? 'bg-node-tensiontext-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                                : 'bg-ink border border-rule-2 text-cream hover:border-cream/20 disabled:opacity-50'
                                }`}
                            title={recognitionRef.current ? "Use Microphone" : "Microphone not supported in this browser"}
                        >
                            <Mic size={18} className={isRecording ? 'text-white' : ''} />
                        </button>

                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isTyping || isRecording}
                            className="p-3 bg-cream text-ink hover:bg-white rounded-xl flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isTyping ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="text-center mt-2 text-[10px] uppercase font-mono tracking-widest text-cream/30">
                        Powered by Gemini TTS
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
