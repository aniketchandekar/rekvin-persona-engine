import { useState, useRef, useEffect } from 'react';
import { Brain, Monitor, Play, Square, Sparkles, Link as LinkIcon, Trash2, AlertCircle, Download, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save, Video, Bot, Eye, ExternalLink, MessageSquare, Target, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Type } from '@google/genai';
import { SavedSession, Narration } from '../types';
import { usePlaywrightAgent } from '../hooks/usePlaywrightAgent';
import { PersonaChatModal } from './PersonaChatModal';

// ── Action badge color map ──────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  click: 'text-node-idea bg-node-idea/15',
  click_element: 'text-node-idea bg-node-idea/15',
  type: 'text-node-journey bg-node-journey/15',
  type_text: 'text-node-journey bg-node-journey/15',
  scroll: 'text-node-question bg-node-question/15',
  scroll_page: 'text-node-question bg-node-question/15',
  hover: 'text-node-scene bg-node-scene/15',
  hover_element: 'text-node-scene bg-node-scene/15',
  narrate: 'text-cream bg-cream/10',
  done: 'text-node-persona bg-node-persona/15',
  finish: 'text-node-persona bg-node-persona/15',
  finish_session: 'text-node-persona bg-node-persona/15',
  abandon: 'text-node-tension bg-node-tension/15',
};

import { PRESET_PERSONAS } from '../constants/presets';

export function TestingHub({ savedPersonas, savedSessions, setSavedSessions, activeTab, setActiveTab, devMode }: { savedPersonas: any[], savedSessions: SavedSession[], setSavedSessions: React.Dispatch<React.SetStateAction<SavedSession[]>>, activeTab: 'simulation' | 'saved', setActiveTab: (tab: 'simulation' | 'saved') => void, devMode: boolean }) {
  const [activePersona, setActivePersona] = useState<any | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [agentGoal, setAgentGoal] = useState<string>('');
  const [testMode, setTestMode] = useState<'vision' | 'playwright'>('playwright');

  // ── Vision mode state ─────────────────────────────────────────────
  const [visionStatus, setVisionStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SavedSession['analysis'] | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [currentVideoBlob, setCurrentVideoBlob] = useState<Blob | null>(null);
  const [chatSessionData, setChatSessionData] = useState<{ id: string, data: any } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const narrationsEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const visionWsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  const playNextAudio = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const base64 = audioQueueRef.current.shift();
    if (base64) {
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audio.onended = () => { isPlayingRef.current = false; playNextAudio(); };
      audio.onerror = () => { isPlayingRef.current = false; playNextAudio(); };
      audio.play().catch(() => { isPlayingRef.current = false; playNextAudio(); });
    }
  };

  // ── Playwright mode state ─────────────────────────────────────────
  const playwright = usePlaywrightAgent();
  const { isSpeaking, isMicActive, toggleMic, userTranscript, agentTranscript } = playwright;

  // Derived combined status for the UI
  const isIdle = testMode === 'vision' ? visionStatus === 'idle' : playwright.status === 'idle';
  const isRunning = testMode === 'vision' ? visionStatus === 'running' : playwright.status === 'running';
  const isCompleted = testMode === 'vision'
    ? visionStatus === 'completed'
    : (playwright.status === 'completed' || playwright.status === 'error');

  useEffect(() => {
    if (narrationsEndRef.current) {
      narrationsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [narrations, playwright.thoughts]);

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, persona: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(persona));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) setActivePersona(JSON.parse(data));
    } catch (err) { console.error("Drop error", err); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  // ══════════════════════════════════════════════════════════════════
  //  VISION MODE FUNCTIONS (unchanged from original)
  // ══════════════════════════════════════════════════════════════════

  const startVisionTest = async () => {
    if (!activePersona) { setError("Please drop a persona into the testing area first."); return; }
    if (!targetUrl) { setError("Please provide a target URL."); return; }
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      recordedChunksRef.current = [];
      try {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => setCurrentVideoBlob(new Blob(recordedChunksRef.current, { type: 'video/webm' }));
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (e) { console.error("MediaRecorder not supported", e); }

      setVisionStatus('running');
      setNarrations([{ id: Date.now().toString(), text: `Agent initialized as "${activePersona.data.label}". Connecting to Live API...` }]);
      stream.getVideoTracks()[0].onended = () => stopVisionTest();

      // Establish WebSocket
      const wsUrl = `ws://${window.location.hostname}:3001/ws/vision`;
      visionWsRef.current = new WebSocket(wsUrl);

      visionWsRef.current.onopen = () => {
        visionWsRef.current?.send(JSON.stringify({ type: 'start', persona: activePersona }));
      };

      visionWsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'ready') {
          setNarrations(prev => [...prev, { id: Date.now().toString(), text: 'Connected. Observing screen...' }]);
          intervalRef.current = window.setInterval(captureAndAnalyze, 1000); // 1 frame per second as per limits
        } else if (data.type === 'transcript' && data.text.trim()) {
          setNarrations(prev => [...prev, { id: Date.now().toString(), text: data.text }]);
        } else if (data.type === 'audio') {
          audioQueueRef.current.push(data.data);
          playNextAudio();
        }
      };

      visionWsRef.current.onclose = () => stopVisionTest();
      visionWsRef.current.onerror = (e) => {
        console.error("Vision WS Error", e);
        setError("Lost connection to Live API backend.");
        stopVisionTest();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
      setError("Screen sharing is required to let the agent see your local app.");
    }
  };

  const stopVisionTest = (shouldAnalyze = true) => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    if (visionWsRef.current) {
      if (visionWsRef.current.readyState === WebSocket.OPEN) {
        visionWsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      visionWsRef.current.close();
      visionWsRef.current = null;
    }

    setVisionStatus('completed');
    setIsThinking(false);
    if (shouldAnalyze && narrations.length > 0) analyzeVisionSession();
  };

  const analyzeVisionSession = async () => {
    setIsAnalyzing(true);
    try {
      const transcript = narrations.map(n => n.text).join('\n');
      const prompt = `Analyze this user testing session transcript for the persona "${activePersona?.data.label}".\nTranscript:\n${transcript}\n\nGenerate a brief story (2 sentences) of their experience and key metrics.`;
      const schema = {
        type: Type.OBJECT,
        properties: {
          story: { type: Type.STRING, description: "A 2-sentence summary of the user's experience and friction points." },
          metrics: {
            type: Type.OBJECT, properties: {
              successScore: { type: Type.NUMBER }, frictionRating: { type: Type.NUMBER },
              sentiment: { type: Type.STRING }, cognitiveLoad: { type: Type.STRING }
            }, required: ["successScore", "frictionRating", "sentiment", "cognitiveLoad"]
          }
        },
        required: ["story", "metrics"]
      };
      const { geminiService } = await import('../services/geminiService');
      setAnalysisResult(await geminiService.generateJSON(prompt, schema));
    } catch (err) { console.error("Analysis failed", err); }
    finally { setIsAnalyzing(false); }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !activePersona) return;
    if (visionWsRef.current?.readyState !== WebSocket.OPEN) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Use a smaller resolution to save bandwidth & tokens
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    visionWsRef.current.send(JSON.stringify({
      type: 'frame',
      data: base64Image,
      timestamp: Date.now()
    }));
  };

  // ══════════════════════════════════════════════════════════════════
  //  PLAYWRIGHT MODE FUNCTIONS
  // ══════════════════════════════════════════════════════════════════

  const startPlaywrightTest = async () => {
    if (!activePersona) { setError("Please drop a persona into the testing area first."); return; }
    if (!targetUrl) { setError("Please provide a target URL."); return; }
    setError(null);
    await playwright.startTest(targetUrl, activePersona, agentGoal);
  };

  // ══════════════════════════════════════════════════════════════════
  //  UNIFIED START / STOP
  // ══════════════════════════════════════════════════════════════════

  const handleStart = () => {
    if (testMode === 'vision') startVisionTest();
    else startPlaywrightTest();
  };

  const handleStop = () => {
    if (testMode === 'vision') stopVisionTest();
    else playwright.stopTest();
  };

  // ══════════════════════════════════════════════════════════════════
  //  SAVE SESSION (UNIFIED)
  // ══════════════════════════════════════════════════════════════════

  const saveSession = () => {
    if (!activePersona) return;

    if (testMode === 'vision') {
      let videoUrl = null;
      if (currentVideoBlob) videoUrl = URL.createObjectURL(currentVideoBlob);
      const newSession: SavedSession = {
        id: Date.now().toString(), date: Date.now(), personaLabel: activePersona.data.label,
        targetUrl, videoUrl, narrations: [...narrations], analysis: analysisResult || undefined,
        mode: 'vision',
      };
      setSavedSessions(prev => [newSession, ...prev]);
    } else {
      // Playwright mode
      const pwAnalysis = playwright.analysis;
      const convertedNarrations: Narration[] = playwright.thoughts.map(t => ({
        id: (t.timestamp || Date.now()).toString(),
        text: `[${t.action.toUpperCase()}] ${t.thought}${t.selector ? ` → ${t.selector}` : ''}`,
      }));
      const newSession: SavedSession = {
        id: Date.now().toString(), date: Date.now(),
        personaLabel: activePersona.data.label,
        personaContent: activePersona.data.content,
        targetUrl, videoUrl: null, narrations: convertedNarrations,
        analysis: pwAnalysis ? {
          story: pwAnalysis.story,
          insights: pwAnalysis.insights,
          metrics: pwAnalysis.metrics,
        } : undefined,
        mode: 'playwright',
        agentThoughts: [...playwright.thoughts],
        agentScreenshots: playwright.screenshots.map(s => ({ ...s, image: '' })), // Don't store base64 in memory
      };
      setSavedSessions(prev => [newSession, ...prev]);
    }

    // Reset
    resetAll();
    setActiveTab('saved');
  };

  const resetAll = () => {
    setVisionStatus('idle');
    setActivePersona(null);
    setTargetUrl('');
    setAgentGoal('');
    setNarrations([]);
    setCurrentVideoBlob(null);
    setAnalysisResult(null);
    playwright.reset();
  };

  const downloadTranscript = () => {
    const lines = testMode === 'vision'
      ? narrations.map(n => `[${new Date(parseInt(n.id) || Date.now()).toLocaleTimeString()}] ${n.text}`)
      : playwright.thoughts.map(t => `[${new Date(t.timestamp || Date.now()).toLocaleTimeString()}] [${t.action.toUpperCase()}] ${t.thought}${t.selector ? ` → ${t.selector}` : ''}`);
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePersona?.data.label?.replace(/\s+/g, '_') || 'agent'}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => stopVisionTest(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="absolute inset-0 flex bg-ink">
      {/* ── Left Sidebar Toggle ──────────────────────────────────────── */}
      {activeTab === 'simulation' && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="p-2 rounded-lg backdrop-blur-md bg-ink-3/90 border border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30 transition-colors shadow-lg"
            title={leftSidebarOpen ? "Hide Personas" : "Show Personas"}
          >
            {leftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      )}

      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTab === 'simulation' && leftSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: 320, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            className="border-r border-rule bg-ink-2/50 flex flex-col z-10 overflow-hidden shrink-0"
          >
            <div className="p-4 pt-16 border-b border-rule w-[320px]">
              <h3 className="font-display text-sm tracking-widest text-cream uppercase">Saved Personas</h3>
              <p className="text-xs text-cream-dim mt-1">Drag a persona to the testing area</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 w-[320px]">
              {devMode && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-node-idea font-mono mb-3 opacity-70">Preset Personas</div>
                  <div className="flex flex-col gap-3">
                    {PRESET_PERSONAS.map((p) => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, p)}
                        className="p-3 rounded-xl border border-node-idea/30 bg-node-idea/5 hover:border-node-idea/60 cursor-grab active:cursor-grabbing transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-node-idea" />
                            <span className="text-sm font-medium text-cream">{p.data.label}</span>
                          </div>
                          <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-node-idea/20 text-node-idea">System</span>
                        </div>
                        <div className="text-xs text-cream-dim line-clamp-2">{p.data.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-rule my-6 opacity-50" />
                  <div className="text-[10px] uppercase tracking-widest text-cream-dim font-mono mb-3">User Personas</div>
                </div>
              )}

              {savedPersonas.length === 0 && !devMode ? (
                <div className="text-center text-cream-dim text-xs italic mt-4">No saved personas.</div>
              ) : (
                savedPersonas.map((p: any) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p)}
                    className="p-3 rounded-xl border border-rule bg-ink-3 hover:border-node-persona/50 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-node-persona" />
                      <span className="text-sm font-medium text-cream">{p.data.label}</span>
                    </div>
                    <div className="text-xs text-cream-dim line-clamp-2">{p.data.content}</div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Testing Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 p-4 pt-14 flex flex-col items-center justify-center overflow-y-auto">

          {/* ════════ SAVED SESSIONS TAB ════════ */}
          {activeTab === 'saved' ? (
            <div className="w-full max-w-4xl flex flex-col gap-6">
              <h2 className="font-display text-2xl tracking-widest text-cream mb-2">Saved Sessions</h2>
              {savedSessions.length === 0 ? (
                <div className="text-center text-cream-dim italic py-12 bg-ink-2 rounded-xl border border-rule">
                  No saved sessions yet. Run a simulation to save one.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {savedSessions.map(session => (
                    <div key={session.id} className="bg-ink-2 border border-rule-2 rounded-2xl overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-rule flex items-center justify-between bg-ink-3/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-node-persona/10 flex items-center justify-center">
                            <Brain size={20} className="text-node-persona" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-cream flex items-center gap-2">
                              {session.personaLabel}
                              {session.mode && (
                                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full ${session.mode === 'playwright' ? 'bg-node-idea/20 text-node-idea' : 'bg-cream/10 text-cream-dim'}`}>
                                  {session.mode === 'playwright' ? '🤖 Agent' : '👁 Vision'}
                                </span>
                              )}
                              {session.personaContent && (
                                <button
                                  onClick={() => setChatSessionData({ id: session.id, data: { label: session.personaLabel, content: session.personaContent } })}
                                  className="p-1.5 rounded-full bg-ink-3 border border-rule-2 hover:bg-node-idea/20 hover:text-node-idea hover:border-node-idea/50 text-cream-dim transition-all"
                                  title="Chat with Persona"
                                >
                                  <MessageSquare size={12} />
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-cream-dim mt-0.5 uppercase tracking-wider">{session.targetUrl}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-cream-dim">{new Date(session.date).toLocaleDateString()}</div>
                          <div className="text-[10px] text-cream-dim/50 mt-1">{new Date(session.date).toLocaleTimeString()}</div>
                        </div>
                      </div>

                      <div className="p-6 flex flex-col lg:flex-row gap-8">
                        <div className="flex-1 flex flex-col gap-6">
                          {/* Persona Details Box */}
                          {session.personaContent && (
                            <div className="bg-ink-3/50 border border-rule p-4 rounded-xl">
                              <h4 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim mb-2">Persona Profile</h4>
                              <p className="text-xs text-cream/80 leading-relaxed font-serif italic">"{session.personaContent}"</p>
                            </div>
                          )}

                          {session.analysis && (
                            <>
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-mono uppercase tracking-widest text-node-idea">The Story</h4>
                                <p className="text-sm text-cream/90 leading-relaxed font-serif italic">"{session.analysis.story}"</p>
                              </div>

                              {/* Insights (Playwright only) */}
                              {session.analysis.insights && session.analysis.insights.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-node-journey">Insights</h4>
                                  <ul className="flex flex-col gap-1.5">
                                    {session.analysis.insights.map((insight, i) => (
                                      <li key={i} className="text-xs text-cream/70 leading-relaxed bg-white/5 p-2 rounded-md border border-white/5">
                                        {insight}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-ink-3 border border-rule p-3 rounded-xl">
                                  <div className="text-[10px] text-cream-dim uppercase tracking-wider mb-1">Success</div>
                                  <div className="text-xl font-display text-node-idea">{session.analysis.metrics.successScore}%</div>
                                </div>
                                <div className="bg-ink-3 border border-rule p-3 rounded-xl">
                                  <div className="text-[10px] text-cream-dim uppercase tracking-wider mb-1">Friction</div>
                                  <div className="text-xl font-display text-node-tension">{session.analysis.metrics.frictionRating}/10</div>
                                </div>
                                <div className="bg-ink-3 border border-rule p-3 rounded-xl">
                                  <div className="text-[10px] text-cream-dim uppercase tracking-wider mb-1">Sentiment</div>
                                  <div className="text-sm font-medium text-cream mt-1">{session.analysis.metrics.sentiment}</div>
                                </div>
                                <div className="bg-ink-3 border border-rule p-3 rounded-xl">
                                  <div className="text-[10px] text-cream-dim uppercase tracking-wider mb-1">Cognitive</div>
                                  <div className="text-sm font-medium text-cream mt-1">{session.analysis.metrics.cognitiveLoad}</div>
                                </div>
                              </div>

                              {/* Extra Playwright metrics */}
                              {session.analysis.metrics.stepsCompleted !== undefined && (
                                <div className="flex gap-3">
                                  <div className="bg-ink-3 border border-rule p-3 rounded-xl flex-1">
                                    <div className="text-[10px] text-cream-dim uppercase tracking-wider mb-1">Steps</div>
                                    <div className="text-lg font-display text-cream">{session.analysis.metrics.stepsCompleted}</div>
                                  </div>
                                  {session.analysis.metrics.abandonmentReason && (
                                    <div className="bg-node-tension/10 border border-node-tension/20 p-3 rounded-xl flex-[2]">
                                      <div className="text-[10px] text-node-tension uppercase tracking-wider mb-1">Abandoned Because</div>
                                      <div className="text-xs text-cream/80">{session.analysis.metrics.abandonmentReason}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex items-center gap-3 pt-2">
                            {session.videoUrl && (
                              <a href={session.videoUrl} download={`session_${session.id}.webm`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-rule text-cream text-xs transition-colors">
                                <Video size={14} /> Download Video
                              </a>
                            )}
                            <button
                              onClick={() => {
                                const content = session.narrations.map(n => `[${new Date(parseInt(n.id)).toLocaleTimeString()}] ${n.text}`).join('\n\n');
                                const blob = new Blob([content], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `transcript_${session.id}.txt`;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                              }}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-rule text-cream text-xs transition-colors"
                            >
                              <Download size={14} /> Download Transcript
                            </button>
                            <button
                              onClick={() => { if (confirm('Delete this session?')) setSavedSessions(prev => prev.filter(s => s.id !== session.id)); }}
                              className="ml-auto p-2 rounded-xl hover:bg-red-500/10 text-cream-dim hover:text-red-400 transition-colors"
                              title="Delete Session"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Detailed Action Transcript */}
                        <div className="lg:w-96 bg-ink-3/50 border border-rule rounded-xl flex flex-col overflow-hidden max-h-[600px]">
                          <div className="p-4 border-b border-rule bg-ink-2/80">
                            <h4 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim">Action Transcript</h4>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                            {session.mode === 'playwright' && session.agentThoughts ? (
                              session.agentThoughts.map((t, idx) => (
                                <div key={idx} className="flex flex-col gap-1 border-l-2 border-rule-2 pl-3 pb-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-node-idea uppercase tracking-wider bg-node-idea/10 px-1.5 py-0.5 rounded">
                                      {t.action}
                                    </span>
                                    <span className="text-[9px] font-mono text-cream-dim/60">
                                      {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : `Step ${t.step + 1}`}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-cream/90 italic leading-snug my-1">"{t.thought}"</p>
                                  {t.selector && (
                                    <div className="text-[10px] font-mono text-cream-dim flex items-center gap-1.5">
                                      <span className="text-node-tension">→</span> <span className="bg-ink-2 px-1 rounded truncate max-w-[200px]">{t.selector}</span>
                                    </div>
                                  )}
                                  {t.value && (
                                    <div className="text-[10px] font-mono text-cream-dim flex items-center gap-1.5">
                                      <span className="text-node-idea">↳</span> Type: <span className="text-cream bg-white/5 px-1 rounded">"{t.value}"</span>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              // Vision fallback
                              session.narrations.map(n => (
                                <div key={n.id} className="text-[11px] text-cream/80 leading-relaxed border-l-2 border-rule-2 pl-3 pb-2 flex flex-col gap-1">
                                  <span className="text-[9px] font-mono text-cream-dim/60">
                                    {new Date(parseInt(n.id) || Date.now()).toLocaleTimeString()}
                                  </span>
                                  <span>{n.text}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            /* ════════ IDLE STATE — SETUP SCREEN ════════ */
          ) : isIdle ? (
            <div className="w-full max-w-2xl flex flex-col gap-4">
              <div className="text-center">
                <h2 className="font-display text-2xl tracking-widest text-cream mb-1">Agent Testing</h2>
                <p className="text-[11px] text-cream-dim font-serif italic">Drop a persona and a link to watch the agent navigate your app.</p>
              </div>

              {/* Mode Switcher */}
              <div className="flex justify-center">
                <div className="flex rounded-xl border border-rule-2 overflow-hidden bg-ink-3/50">
                  <button
                    onClick={() => setTestMode('vision')}
                    className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest transition-all ${testMode === 'vision' ? 'bg-cream text-ink font-medium' : 'text-cream-dim hover:text-cream hover:bg-white/5'}`}
                  >
                    <Eye size={14} /> Vision Mode
                  </button>
                  <button
                    onClick={() => setTestMode('playwright')}
                    className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest transition-all ${testMode === 'playwright' ? 'bg-cream text-ink font-medium' : 'text-cream-dim hover:text-cream hover:bg-white/5'}`}
                  >
                    <Bot size={14} /> Agent Mode
                  </button>
                </div>
              </div>

              {/* Mode Description */}
              <div className="text-center text-[11px] text-cream-dim/60 max-w-md mx-auto">
                {testMode === 'vision' ? (
                  <p>👁 <span className="text-cream-dim">Vision Mode</span> — Share your screen and the AI observes and narrates as the persona. No interactions.</p>
                ) : (
                  <p>🤖 <span className="text-cream-dim">Agent Mode</span> — The AI autonomously navigates your app using Playwright, clicking and typing as the persona. Requires agent server.</p>
                )}
              </div>

              {/* Persona Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-colors ${activePersona ? 'border-node-persona/50 bg-node-persona/5' : 'border-rule-2 bg-ink-2/50 hover:border-cream/30'}`}
              >
                {activePersona ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-node-persona/20 flex items-center justify-center">
                      <Brain className="text-node-persona" size={24} />
                    </div>
                    <div className="text-center">
                      <div className="text-cream font-medium">{activePersona.data.label}</div>
                      <div className="text-xs text-node-persona mt-1">Active Persona</div>
                    </div>
                    <button onClick={() => setActivePersona(null)} className="text-xs text-cream-dim hover:text-red-400 underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-cream-dim">
                    <Brain size={32} className="opacity-50" />
                    <span>Drag and drop a persona here</span>
                  </div>
                )}
              </div>

              {/* URL Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-cream-dim ml-1">Target Application</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-dim pointer-events-none"><LinkIcon size={14} /></div>
                  <input
                    type="text" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="e.g., http://localhost:3000"
                    className="w-full bg-ink-3 border border-rule-2 rounded-xl py-3 pl-11 pr-4 text-sm text-cream focus:outline-none focus:border-node-idea/50 transition-colors"
                  />
                </div>
              </div>

              {/* Goal Input (Optional) */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[10px] font-mono uppercase tracking-widest text-cream-dim ml-1">Session Goal (Optional)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-dim pointer-events-none"><Target size={14} /></div>
                  <input
                    type="text" value={agentGoal} onChange={(e) => setAgentGoal(e.target.value)}
                    placeholder="e.g., 'Find the pricing page' or 'Add a blue shirt to cart'"
                    className="w-full bg-ink-3 border border-rule-2 rounded-xl py-3 pl-11 pr-4 text-sm text-cream focus:outline-none focus:border-node-idea/50 transition-colors"
                  />
                </div>
              </div>

              {(error || playwright.error) && (
                <div className="flex items-center gap-2 text-red-400 text-[11px] bg-red-400/10 p-2.5 rounded-lg border border-red-400/20">
                  <AlertCircle size={14} />
                  {error || playwright.error}
                </div>
              )}

              <button
                onClick={handleStart}
                className="w-full py-3.5 rounded-xl bg-cream text-ink text-sm font-medium hover:bg-white transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {testMode === 'playwright' ? <Bot size={18} /> : <Play size={18} fill="currentColor" />}
                {testMode === 'playwright' ? 'Start Agent Testing' : 'Start Vision Testing'}
              </button>
            </div>

            /* ════════ RUNNING / COMPLETED STATE ════════ */
          ) : (
            <div className="w-full h-full flex gap-4 overflow-hidden">
              {/* Screen View */}
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Top Bar */}
                <div className="flex items-center justify-between bg-ink-2 border border-rule-2 rounded-xl p-3">
                  {isRunning || playwright.status === 'analyzing' ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-node-idea text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-node-idea animate-pulse" />
                          {playwright.status === 'analyzing' ? 'Analyzing Session...' : 'Agent Active'}
                        </div>
                        {testMode === 'playwright' && playwright.currentUrl && (
                          <div className="text-cream-dim text-xs font-mono px-3 py-1 bg-ink-3 rounded-md truncate max-w-[300px] flex items-center gap-1.5">
                            <ExternalLink size={10} />
                            {playwright.currentUrl}
                          </div>
                        )}
                        {testMode === 'vision' && (
                          <div className="text-cream-dim text-xs font-mono px-3 py-1 bg-ink-3 rounded-md">{targetUrl}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {testMode === 'playwright' && (
                          <button
                            onClick={() => playwright.toggleMic()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isMicActive
                              ? 'bg-node-idea/20 text-node-idea border border-node-idea/40 shadow-[0_0_12px_rgba(var(--node-idea-rgb),0.3)]'
                              : 'bg-ink-3 text-cream-dim hover:text-cream hover:bg-white/10 border border-rule-2'
                              }`}
                            title={isMicActive ? 'Mute Microphone' : 'Activate Microphone to talk to the agent'}
                          >
                            {isMicActive ? <Mic size={12} className="animate-pulse" /> : <MicOff size={12} />}
                            {isMicActive ? 'Listening...' : 'Talk to Agent'}
                          </button>
                        )}
                        <button
                          onClick={handleStop}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-medium"
                        >
                          <Square size={12} fill="currentColor" /> Stop Test
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-cream text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-cream-dim" /> Test Completed
                        </div>
                        {testMode === 'playwright' && (
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-node-idea/20 text-node-idea">
                            Agent Mode
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {isAnalyzing || (playwright.status as string) === 'analyzing' ? (
                          <div className="flex items-center gap-2 text-node-idea text-xs font-medium bg-node-idea/10 px-3 py-1.5 rounded-lg border border-node-idea/20">
                            <Sparkles size={12} className="animate-pulse" /> Analyzing Experience...
                          </div>
                        ) : (
                          <>
                            <button onClick={saveSession} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-node-persona/20 text-node-persona hover:bg-node-persona/30 transition-colors text-xs font-medium">
                              <Save size={12} /> Save Session
                            </button>
                            <button onClick={downloadTranscript} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-node-idea/20 text-node-idea hover:bg-node-idea/30 transition-colors text-xs font-medium">
                              <Download size={12} /> Download Transcript
                            </button>
                          </>
                        )}
                        <button onClick={resetAll} disabled={isAnalyzing} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-3 text-cream-dim hover:text-cream hover:bg-white/5 transition-colors text-xs font-medium disabled:opacity-50">
                          New Test
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Main Viewport */}
                <div className="flex-1 bg-black rounded-xl overflow-hidden border border-rule-2 relative shadow-2xl flex items-center justify-center min-h-0 border-rule/50">
                  {testMode === 'vision' ? (
                    /* Vision: live video stream */
                    visionStatus === 'running' ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          <motion.div
                            animate={{ y: ['-100%', '200%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="w-full h-32 bg-gradient-to-b from-transparent via-node-idea/10 to-transparent border-b border-node-idea/30"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-cream-dim flex flex-col items-center gap-4">
                        <Monitor size={48} className="opacity-20" />
                        <p className="font-serif italic">Screen recording ended.</p>
                      </div>
                    )
                  ) : (
                    /* Playwright: live screenshot from backend */
                    playwright.latestScreenshot ? (
                      <img
                        src={`data:image/jpeg;base64,${playwright.latestScreenshot}`}
                        className="w-full h-full object-contain"
                        alt="Agent view of target app"
                      />
                    ) : playwright.status === 'running' ? (
                      <div className="flex flex-col items-center gap-4 text-cream-dim">
                        <Bot size={48} className="opacity-30 animate-pulse" />
                        <p className="font-serif italic">Agent is loading the page...</p>
                      </div>
                    ) : (
                      <div className="text-cream-dim flex flex-col items-center gap-4">
                        <Bot size={48} className="opacity-20" />
                        <p className="font-serif italic">Agent session ended.</p>
                      </div>
                    )
                  )}

                  {/* Playwright analysis overlay */}
                  {testMode === 'playwright' && playwright.analysis && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink via-ink/95 to-transparent p-6 pointer-events-none">
                      <div className="text-sm font-serif italic text-cream/80 mb-3">"{playwright.analysis.story}"</div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-node-idea font-mono">Success: {playwright.analysis.metrics.successScore}%</span>
                        <span className="text-node-tension font-mono">Friction: {playwright.analysis.metrics.frictionRating}/10</span>
                        <span className="text-cream-dim font-mono">Steps: {playwright.analysis.metrics.stepsCompleted}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right Sidebar: Thought Stream ────────────────────────── */}
              <AnimatePresence>
                {rightSidebarOpen && (
                  <motion.div
                    initial={{ width: 0, opacity: 0, x: 20 }}
                    animate={{ width: 320, opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 20 }}
                    className="flex flex-col gap-3 shrink-0 overflow-hidden"
                  >
                    <div className="w-[320px] flex flex-col gap-3 h-full">
                      <div className="bg-ink-2 border border-rule-2 rounded-xl p-3 flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-node-persona/20 flex items-center justify-center shrink-0">
                          <Brain className="text-node-persona" size={20} />
                        </div>
                        <div>
                          <div className="text-xs text-node-persona font-mono uppercase tracking-widest mb-0.5">Testing As</div>
                          <div className="text-sm font-medium text-cream flex items-center gap-2 truncate">
                            {activePersona?.data.label}
                            {isSpeaking && (
                              <div className="flex items-center gap-0.5">
                                <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-node-idea rounded-full" />
                                <motion.div animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-node-idea rounded-full" />
                                <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-node-idea rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                        {testMode === 'playwright' && (
                          <span className="ml-auto text-[9px] font-mono uppercase px-2 py-1 rounded-full bg-node-idea/20 text-node-idea">🤖 Live API</span>
                        )}
                      </div>

                      {/* Live Transcription Panel */}
                      {testMode === 'playwright' && (userTranscript || agentTranscript) && (
                        <div className="bg-ink-3/50 border border-rule-2 rounded-xl p-3 flex flex-col gap-2">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-cream-dim flex items-center gap-1.5">
                            <Mic size={10} /> Live Transcription
                          </div>
                          {userTranscript && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] font-mono text-node-journey bg-node-journey/10 px-1.5 py-0.5 rounded shrink-0">You</span>
                              <span className="text-[11px] text-cream/80 leading-snug italic">"{userTranscript}"</span>
                            </div>
                          )}
                          {agentTranscript && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] font-mono text-node-idea bg-node-idea/10 px-1.5 py-0.5 rounded shrink-0">Agent</span>
                              <span className="text-[11px] text-cream/80 leading-snug italic">"{agentTranscript}"</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Thought stream */}
                      <div className="flex-1 bg-ink-2 border border-rule-2 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-rule-2 bg-ink-3 flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-widest text-cream-dim">
                            {isRunning ? (testMode === 'playwright' ? 'Live Agent Actions' : 'Live Narration') : 'Session Log'}
                          </span>
                          {(isThinking || playwright.status === 'running') && <Sparkles size={14} className="text-node-idea animate-pulse" />}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                          <AnimatePresence initial={false}>
                            {testMode === 'vision' ? (
                              /* Vision mode: narrations */
                              narrations.map((narration) => (
                                <motion.div
                                  key={narration.id}
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  className="bg-ink-3 border border-rule rounded-xl p-3 text-sm text-cream/80 leading-relaxed shadow-sm relative"
                                >
                                  <div className="absolute -left-1.5 top-4 w-3 h-3 bg-ink-3 border border-rule rotate-45" />
                                  <div className="relative z-10">{narration.text}</div>
                                </motion.div>
                              ))
                            ) : (
                              /* Playwright mode: structured thoughts */
                              playwright.thoughts.map((thought, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  className="bg-ink-3 border border-rule rounded-xl p-3 shadow-sm relative"
                                >
                                  <div className="absolute -left-1.5 top-4 w-3 h-3 bg-ink-3 border border-rule rotate-45" />
                                  <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[10px] font-mono text-cream-dim w-5 shrink-0">{thought.step + 1}.</span>
                                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${ACTION_COLORS[thought.action] || 'text-cream-dim bg-white/10'}`}>
                                        {thought.action}
                                      </span>
                                      {thought.selector && (
                                        <code className="text-[9px] text-cream-dim/60 font-mono truncate max-w-[140px]">{thought.selector}</code>
                                      )}
                                    </div>
                                    <p className="text-sm text-cream/80 leading-relaxed">{thought.thought}</p>
                                    {thought.value && (
                                      <div className="mt-1 text-[10px] text-node-journey font-mono">Typed: "{thought.value}"</div>
                                    )}
                                    {thought.reason && (
                                      <div className="mt-1 text-[10px] text-node-tension">Reason: {thought.reason}</div>
                                    )}
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </AnimatePresence>

                          {/* Status message */}
                          {testMode === 'playwright' && playwright.statusMessage && playwright.status !== 'idle' && (
                            <div className="text-[10px] text-cream-dim italic text-center py-2">
                              {playwright.statusMessage}
                            </div>
                          )}

                          {/* Playwright insights panel */}
                          {testMode === 'playwright' && playwright.analysis?.insights && playwright.analysis.insights.length > 0 && (
                            <div className="mt-2 bg-node-idea/10 border border-node-idea/20 rounded-xl p-3">
                              <div className="text-[10px] font-mono uppercase tracking-widest text-node-idea mb-2 flex items-center gap-1.5">
                                <Sparkles size={12} /> Key Insights
                              </div>
                              <ul className="flex flex-col gap-1.5">
                                {playwright.analysis.insights.map((insight, i) => (
                                  <li key={i} className="text-[11px] text-cream/70 leading-relaxed">• {insight}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div ref={narrationsEndRef} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right Sidebar Toggle */}
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className="p-2 rounded-lg backdrop-blur-md bg-ink-3/90 border border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30 transition-colors shadow-lg"
                  title={rightSidebarOpen ? "Hide Transcript" : "Show Transcript"}
                >
                  {rightSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
