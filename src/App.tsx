import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, FilePlus2, MessageSquare, Plus, Save, Trash2, ArrowRight, Play, Layout, Sparkles, Send, Search, Download, CheckCircle2, ChevronRight, X, AlertCircle, BarChart3, Presentation, Target, UserCircle, Wand2, RefreshCw, BoxSelect, Terminal, FileCode2, Globe, Lightbulb, Mic, Square, PanelLeftClose, PanelLeftOpen, Info } from 'lucide-react';
import { ReactFlow, Background, Controls, addEdge, applyNodeChanges, applyEdgeChanges, Node, Edge, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './components/CustomNodes';
import CustomEdge from './components/CustomEdge';

import { TestingHub } from './components/TestingHub';
import { MetricsHub } from './components/MetricsHub';
import { SavedSession } from './types';
import { PRESET_PERSONAS, PRESET_SESSIONS } from './constants/presets';
import { PersonaChatModal } from './components/PersonaChatModal';
import { OnboardingModal, OnboardingType } from './components/OnboardingModal';

type SavedPersona = {
  id: string;
  data: any;
  scoreData: {
    totalScore: number;
    signalLabel: string;
    signalColor: string;
    signalBgColor: string;
    topAction: string;
  };
};

const initialNodes: Node[] = [
  {
    id: 'idea-root',
    type: 'idea',
    position: { x: 100, y: 300 },
    deletable: false,
    data: {
      label: 'Idea Node',
      content: '',
      fields: {}
    }
  },
  {
    id: 'persona-root',
    type: 'persona',
    position: { x: 800, y: 300 },
    deletable: false,
    data: {
      label: 'Persona Node',
      content: '',
      fields: {}
    }
  }
];
const initialEdges: Edge[] = [];

const NODE_TYPES_LIST = [
  { type: 'idea', label: 'Idea Node', color: 'bg-node-idea', description: 'Capture core concepts, product ideas, or main themes.' },
  { type: 'assume', label: 'Assumption Node', color: 'bg-node-assume', description: 'Document assumptions about the user or market.' },
  { type: 'customInput', label: 'Input Node', color: 'bg-node-input', description: 'Raw data, user quotes, or direct feedback.' },
  { type: 'research', label: 'Research Node', color: 'bg-node-research', description: 'Findings from web searches or market research.' },
  { type: 'scene', label: 'Scene Node', color: 'bg-node-scene', description: 'Context or environment of the user experience.' },
  { type: 'journey', label: 'Journey Node', color: 'bg-node-journey', description: 'Map out a step in the user process.' },
  { type: 'tension', label: 'Tension Node', color: 'bg-node-tension', description: 'Highlight pain points or frustrations.' },
  { type: 'question', label: 'Question Node', color: 'bg-node-question', description: 'Open questions or areas for more research.' },
  { type: 'persona', label: 'Persona Node', color: 'bg-node-persona', description: 'Synthesize findings into a user archetype.' },
];

const edgeTypes = {
  default: CustomEdge,
};

export default function App() {
  const [mainTab, setMainTab] = useState<'personas' | 'testing' | 'metrics'>('personas');
  const [personaSubTab, setPersonaSubTab] = useState<'free' | 'saved'>('free');
  const [testingSubTab, setTestingSubTab] = useState<'simulation' | 'saved'>('simulation');
  const [savedPersonas, setSavedPersonas] = useState<SavedPersona[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [chatModalData, setChatModalData] = useState<{ persona: any, sessionData?: any } | null>(null);
  const [viewedOnboarding, setViewedOnboarding] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('rekvin_onboarding');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const markOnboardingViewed = (type: OnboardingType) => {
    setViewedOnboarding(prev => {
      const next = { ...prev, [type]: true };
      localStorage.setItem('rekvin_onboarding', JSON.stringify(next));
      return next;
    });
  };

  const triggerOnboarding = (type: OnboardingType) => {
    setViewedOnboarding(prev => {
      const next = { ...prev, [type]: false };
      localStorage.setItem('rekvin_onboarding', JSON.stringify(next));
      return next;
    });
  };

  const allSessions = useMemo(() => {
    return devMode ? [...PRESET_SESSIONS, ...savedSessions] : savedSessions;
  }, [devMode, savedSessions]);

  useEffect(() => {
    const handleSavePersona = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, data, scoreData } = customEvent.detail;

      setSavedPersonas(prev => {
        // Update if exists, else add
        const exists = prev.findIndex(p => p.id === id);
        if (exists >= 0) {
          const newPersonas = [...prev];
          newPersonas[exists] = { id, data, scoreData };
          return newPersonas;
        }
        return [...prev, { id, data, scoreData }];
      });
    };

    window.addEventListener('save-persona', handleSavePersona);
    return () => window.removeEventListener('save-persona', handleSavePersona);
  }, []);

  const handleDeletePersona = (id: string) => {
    setSavedPersonas(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-ink text-cream font-sans">
      {/* Top Nav */}
      <nav className="h-14 border-b border-rule bg-ink/85 backdrop-blur-xl flex items-center justify-between px-12 z-50 sticky top-0">
        <div className="flex items-center gap-6">
          <div className="font-logo text-2xl tracking-tight text-cream font-semibold">
            rek<span className="text-node-idea">vin</span>
          </div>

          <div className="h-6 w-px bg-rule mx-2" />

          <button
            onClick={() => setDevMode(!devMode)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${devMode ? 'bg-node-idea/10 border-node-idea text-node-idea shadow-[0_0_15px_rgba(var(--node-idea-rgb),0.2)]' : 'bg-ink-3 border-rule text-cream-dim hover:text-cream hover:border-cream/30'}`}
          >
            <Sparkles size={12} className={devMode ? 'animate-pulse' : ''} />
            <span className="text-[10px] font-mono uppercase tracking-wider">{devMode ? 'Dev Mode On' : 'Dev Mode Off'}</span>
          </button>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex gap-2">
            <button onClick={() => setMainTab('personas')} className={`text-[11px] uppercase tracking-widest transition-all px-4 py-2 rounded-full ${mainTab === 'personas' ? 'bg-white/10 text-cream shadow-sm' : 'text-cream-dim hover:text-cream hover:bg-white/5'}`}>Personas</button>
            <button onClick={() => setMainTab('testing')} className={`text-[11px] uppercase tracking-widest transition-all px-4 py-2 rounded-full ${mainTab === 'testing' ? 'bg-white/10 text-cream shadow-sm' : 'text-cream-dim hover:text-cream hover:bg-white/5'}`}>Testing</button>
            <button onClick={() => setMainTab('metrics')} className={`text-[11px] uppercase tracking-widest transition-all px-4 py-2 rounded-full ${mainTab === 'metrics' ? 'bg-white/10 text-cream shadow-sm' : 'text-cream-dim hover:text-cream hover:bg-white/5'}`}>Metrics</button>
          </div>
        </div>
      </nav>

      {/* Sub Nav for Personas */}
      {mainTab === 'personas' && (
        <div className="h-10 border-b border-rule bg-ink-2/80 backdrop-blur-md flex items-end justify-between px-12 z-40">
          <div className="flex gap-6 h-full">
            <button onClick={() => setPersonaSubTab('free')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center gap-1.5 border-b-2 px-1 ${personaSubTab === 'free' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>
              {personaSubTab === 'free' && <Sparkles size={10} className="animate-pulse" />}
              Free Build
            </button>
            <button onClick={() => setPersonaSubTab('saved')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center gap-1.5 border-b-2 px-1 ${personaSubTab === 'saved' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>
              {personaSubTab === 'saved' && <Sparkles size={10} className="animate-pulse" />}
              Saved
              {savedPersonas.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${personaSubTab === 'saved' ? 'bg-node-idea/20 text-node-idea' : 'bg-ink-3 text-cream-dim'}`}>{savedPersonas.length}</span>}
            </button>
          </div>
          <button
            onClick={() => triggerOnboarding('personas')}
            className="h-full flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cream-dim hover:text-node-idea transition-colors px-1 border-b-2 border-transparent"
          >
            <Info size={12} />
            Guide
          </button>
        </div>
      )}

      {/* Sub Nav for Testing */}
      {mainTab === 'testing' && (
        <div className="h-10 border-b border-rule bg-ink-2/80 backdrop-blur-md flex items-end justify-between px-12 z-40">
          <div className="flex gap-6 h-full">
            <button onClick={() => setTestingSubTab('simulation')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center border-b-2 px-1 ${testingSubTab === 'simulation' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>Simulation</button>
            <button onClick={() => setTestingSubTab('saved')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center gap-1.5 border-b-2 px-1 ${testingSubTab === 'saved' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>
              Saved Sessions
              {allSessions.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${testingSubTab === 'saved' ? 'bg-node-idea/20 text-node-idea' : 'bg-ink-3 text-cream-dim'}`}>{allSessions.length}</span>}
            </button>
          </div>
          <button
            onClick={() => triggerOnboarding('testing')}
            className="h-full flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cream-dim hover:text-node-idea transition-colors px-1 border-b-2 border-transparent"
          >
            <Info size={12} />
            Guide
          </button>
        </div>
      )}

      {mainTab === 'metrics' && (
        <div className="h-10 border-b border-rule bg-ink-2/80 backdrop-blur-md flex items-end justify-between px-12 z-40">
          <div className="flex gap-6 h-full">
            <div className="text-[10px] uppercase tracking-widest transition-all h-full flex items-center border-b-2 px-1 border-node-idea text-node-idea">
              Analytics Overview
            </div>
          </div>
          <button
            onClick={() => triggerOnboarding('metrics')}
            className="h-full flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cream-dim hover:text-node-idea transition-colors px-1 border-b-2 border-transparent"
          >
            <Info size={12} />
            Guide
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {mainTab === 'testing' ? (
            <motion.div
              key="testing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0"
            >
              <TestingHub
                savedPersonas={savedPersonas}
                savedSessions={allSessions}
                setSavedSessions={setSavedSessions}
                activeTab={testingSubTab}
                setActiveTab={setTestingSubTab}
                devMode={devMode}
                onOpenChat={(persona, sessionData) => setChatModalData({ persona, sessionData })}
              />
            </motion.div>
          ) : mainTab === 'metrics' ? (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0"
            >
              <MetricsHub savedSessions={allSessions} />
            </motion.div>
          ) : personaSubTab === 'free' ? (
            <motion.div
              key="free"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0"
            >
              <ReactFlowProvider>
                <FreeBuildCanvas />
              </ReactFlowProvider>
            </motion.div>
          ) : (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 overflow-y-auto p-8"
            >
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-display text-3xl tracking-widest text-cream">Saved Personas</h2>
                  <div className="text-sm text-cream-dim font-mono uppercase tracking-widest">
                    {savedPersonas.length + (devMode ? PRESET_PERSONAS.length : 0)} {savedPersonas.length + (devMode ? PRESET_PERSONAS.length : 0) === 1 ? 'Persona' : 'Personas'}
                  </div>
                </div>

                {savedPersonas.length === 0 && (!devMode || PRESET_PERSONAS.length === 0) ? (
                  <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-rule-2 rounded-2xl bg-ink-2/50">
                    <Brain size={48} className="text-cream-dim/30 mb-4" />
                    <p className="text-cream-dim font-serif italic text-lg">No personas saved yet.</p>
                    <p className="text-cream-dim/50 text-sm mt-2">Go to Free Build, hover over a Persona node, and click the Save icon.</p>
                    <button
                      onClick={() => setPersonaSubTab('free')}
                      className="mt-6 px-6 py-2 rounded-full border border-rule-2 bg-ink-3 text-cream/70 text-sm hover:bg-white/5 hover:border-cream/30 hover:text-cream transition-all"
                    >
                      Go to Free Build
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Render Dev Mode Presets first if active */}
                    {devMode && PRESET_PERSONAS.map((persona) => (
                      <div key={persona.id} className="relative group">
                        <StaticPersonaCard persona={persona as any} isPreset onChat={() => setChatModalData({ persona })} />
                      </div>
                    ))}

                    {savedPersonas.map((persona) => (
                      <div key={persona.id} className="relative group">
                        <StaticPersonaCard persona={persona} onChat={() => setChatModalData({ persona })} />
                        <button
                          onClick={() => handleDeletePersona(persona.id)}
                          className="absolute -top-3 -right-3 p-2 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-node-tension hover:bg-node-tension/10 shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10"
                          title="Delete Persona"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Modals */}
        <AnimatePresence>
          {chatModalData && (
            <PersonaChatModal
              persona={chatModalData.persona}
              sessionData={chatModalData.sessionData}
              onClose={() => setChatModalData(null)}
            />
          )}
        </AnimatePresence>

        {/* Onboarding Modals */}
        <AnimatePresence>
          {mainTab === 'personas' && !viewedOnboarding.personas && (
            <OnboardingModal type="personas" onClose={() => markOnboardingViewed('personas')} />
          )}
          {mainTab === 'testing' && !viewedOnboarding.testing && (
            <OnboardingModal type="testing" onClose={() => markOnboardingViewed('testing')} />
          )}
          {mainTab === 'metrics' && !viewedOnboarding.metrics && (
            <OnboardingModal type="metrics" onClose={() => markOnboardingViewed('metrics')} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StaticPersonaCard({ persona, isPreset, onChat }: { persona: SavedPersona; isPreset?: boolean; onChat?: () => void }) {
  const { data, scoreData } = persona;

  return (
    <div className="px-4 py-3 rounded-xl border border-node-persona/30 bg-ink-2 shadow-lg relative overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-node-persona" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-cream/35">persona Node</span>
        </div>
        <div className="flex items-center gap-2">
          {isPreset && (
            <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-node-idea/20 text-node-idea">System</span>
          )}
          {onChat && (
            <button
              onClick={onChat}
              className="p-1.5 rounded-full bg-ink-3 border border-rule-2 hover:bg-node-idea/20 hover:text-node-idea hover:border-node-idea/50 text-cream-dim transition-all"
              title="Chat with Persona"
            >
              <MessageSquare size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="font-display text-lg tracking-wider text-cream mb-2">{data.label}</div>

      <div className="text-sm text-cream/70 leading-relaxed mb-4 whitespace-pre-wrap flex-1">
        {data.content}
      </div>

      <div className="flex flex-col gap-1.5 mb-2">
        {Object.entries(data.fields || {}).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-[11px] text-cream/40 bg-ink-3 px-2.5 py-1.5 rounded-md">
            <span className="font-mono text-[10px] shrink-0 pt-px text-node-persona">{key}</span>
            <span className="leading-snug break-all">{value as string}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-rule-2/50 flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-mono text-cream/50 uppercase tracking-wider">Quality Score</span>
          <span className={`text-lg font-display ${scoreData.signalColor}`}>{scoreData.totalScore}<span className="text-xs text-cream/30">/100</span></span>
        </div>

        <div className="h-1.5 w-full bg-ink-3 rounded-full overflow-hidden">
          <div
            className={`h-full ${scoreData.signalBgColor} transition-all duration-500 ease-out`}
            style={{ width: `${scoreData.totalScore}%` }}
          />
        </div>

        <div className={`text-[11px] font-medium ${scoreData.signalColor} mb-1`}>
          {scoreData.signalLabel}
        </div>

        <div className="text-[10px] leading-snug text-cream/60 bg-white/5 p-2 rounded-md border border-white/5">
          <span className="font-bold text-cream/80">To improve:</span> {scoreData.topAction}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-node-persona opacity-50" />
    </div>
  );
}

function NodeDetailPanel({ nodeId, onClose, nodes, edges, setNodes }: { nodeId: string, onClose: () => void, nodes: Node[], edges: Edge[], setNodes: any }) {
  const node = nodes.find(n => n.id === nodeId);
  const [isGenerating, setIsGenerating] = useState(false);

  const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
  const connectedNodeIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
  connectedNodeIds.delete(nodeId);
  const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));

  const generateInsights = useCallback(async () => {
    const content = node?.data.content as string;
    if (!node || isGenerating || !content || content.trim() === '') return;

    setIsGenerating(true);
    try {
      const { geminiService } = await import('./services/geminiService');
      const contextStr = connectedNodes.length > 0
        ? connectedNodes.map(n => `[${n.type}] ${n.data.content as string}`).join(' | ')
        : 'No connected nodes for context.';

      const insights = await geminiService.generateNodeInsights(node.type, content, contextStr);
      setNodes((nds: Node[]) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, insights } } : n));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  }, [node, connectedNodes, isGenerating, nodeId, setNodes]);

  useEffect(() => {
    if (node && !node.data.insights && !isGenerating && node.data.content && (node.data.content as string).trim() !== '') {
      generateInsights();
    }
  }, [nodeId, node, isGenerating, generateInsights]);

  if (!node) return null;

  const nodeColor = NODE_TYPES_LIST.find(t => t.type === node.type)?.color || 'bg-cream';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-0 bottom-0 w-[400px] bg-ink-2/95 backdrop-blur-xl border-l border-rule-2 shadow-2xl z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-rule-2">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${nodeColor}`} />
          <h2 className="font-display text-2xl tracking-wide text-cream capitalize">{node.type} Details</h2>
        </div>
        <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
        {/* Content */}
        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim mb-3">Content</h3>
          <div className="text-sm text-cream/90 leading-relaxed whitespace-pre-wrap bg-ink-3 p-4 rounded-xl border border-rule-2">
            {node.data.content as React.ReactNode}
          </div>
        </section>

        {/* Fields */}
        {Object.keys(node.data.fields || {}).length > 0 && (
          <section>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim mb-3">Extracted Data</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(node.data.fields).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1 bg-ink-3 p-3 rounded-xl border border-rule-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${nodeColor.replace('bg-', 'text-')}`}>{key}</span>
                  <span className="text-sm text-cream/80">{value as string}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Insights */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim flex items-center gap-2">
              <Sparkles size={12} className="text-node-idea" />
              AI Insights
            </h3>
            {node.data.insights && (
              <button onClick={generateInsights} disabled={isGenerating} className="text-[10px] text-cream-dim hover:text-cream transition-colors disabled:opacity-50">
                Regenerate
              </button>
            )}
          </div>

          <div className="bg-gradient-to-br from-ink-3 to-ink-2 p-4 rounded-xl border border-node-idea/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-node-idea/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

            {isGenerating ? (
              <div className="flex items-center gap-3 text-cream-dim text-sm py-4">
                <Sparkles size={16} className="animate-pulse text-node-idea" />
                <span className="animate-pulse">Analyzing node context...</span>
              </div>
            ) : node.data.insights ? (
              <div className="text-sm text-cream/80 leading-relaxed whitespace-pre-wrap relative z-10">
                {node.data.insights as React.ReactNode}
              </div>
            ) : (
              <div className="text-sm text-cream-dim italic py-2">
                No insights generated yet.
              </div>
            )}
          </div>
        </section>

        {/* Connected Nodes */}
        <section>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-cream-dim mb-3">
            Connected Context ({connectedNodes.length})
          </h3>
          {connectedNodes.length > 0 ? (
            <div className="flex flex-col gap-2">
              {connectedNodes.map(cn => (
                <div key={cn.id} className="flex items-start gap-3 bg-ink-3 p-3 rounded-xl border border-rule-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${NODE_TYPES_LIST.find(t => t.type === cn.type)?.color || 'bg-cream'}`} />
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-cream-dim mb-1">{cn.type}</div>
                    <div className="text-xs text-cream/70 line-clamp-2">{cn.data.content as React.ReactNode}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-cream-dim italic bg-ink-3 p-4 rounded-xl border border-rule-2">
              Connect this node to others to generate richer insights.
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

function FreeBuildCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [availableFlows, setAvailableFlows] = useState<{ id: string, nodes: Node[] }[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNode } = useReactFlow();

  useEffect(() => {
    const handleOpenDetails = (e: Event) => {
      const customEvent = e as CustomEvent;
      setDetailNodeId(customEvent.detail.id);
    };
    window.addEventListener('open-node-details', handleOpenDetails);
    return () => window.removeEventListener('open-node-details', handleOpenDetails);
  }, []);

  const executeSmartWorkflow = async () => {
    setIsWorkflowRunning(true);
    try {
      const { geminiService } = await import('./services/geminiService');

      // 1. Identify "Target" nodes (those with incoming edges)
      const targetNodeIds = Array.from(new Set(edges.map(e => e.target)));
      
      // 2. Sort targets topologically (simple version: nodes with fewer upstream nodes first)
      // This ensures if Flow is A -> B -> C, we generate B then C.
      const getUpstreamCount = (id: string, visited = new Set<string>()): number => {
        if (visited.has(id)) return 0;
        visited.add(id);
        const parents = edges.filter(e => e.target === id).map(e => e.source);
        return parents.length + parents.reduce((acc, p) => acc + getUpstreamCount(p, visited), 0);
      };

      const sortedTargets = [...targetNodeIds].sort((a, b) => getUpstreamCount(a) - getUpstreamCount(b));

      for (const nodeId of sortedTargets) {
        const currentNode = nodes.find(n => n.id === nodeId);
        if (!currentNode) continue;

        // Find all incoming parents
        const parentEdges = edges.filter(e => e.target === nodeId);
        const parents = nodes.filter(n => parentEdges.map(e => e.source).includes(n.id));
        
        // Only run if parents have content
        const parentContent = parents
          .filter(p => p.data.content && (p.data.content as string).trim() !== '' && p.data.content !== 'Generating...')
          .map(p => `[${p.type}] (${p.data.label}): ${p.data.content}`)
          .join('\n\n---\n\n');

        if (!parentContent) continue;

        // Indicate generation
        setNodes(nds => nds.map(n => n.id === nodeId ? {
          ...n,
          data: { ...n.data, content: "Generating..." }
        } : n));

        const newContent = await geminiService.runWorkflowNode(
          currentNode.type,
          currentNode.data.label as string,
          parentContent,
          currentNode.data.content as string
        );

        // Update content
        setNodes(nds => nds.map(n => n.id === nodeId ? {
          ...n,
          data: { ...n.data, content: newContent }
        } : n));

        // Regenerate fields/voice
        const newFieldsStr = await geminiService.generateFields(currentNode.type, newContent);
        let detectedVoice = currentNode.data.voiceName;
        if (currentNode.type === 'persona') {
          detectedVoice = await geminiService.detectPersonaVoice(currentNode.data.label as string, newContent);
        }

        try {
          const newFields = JSON.parse(newFieldsStr);
          setNodes(nds => nds.map(n => n.id === nodeId ? {
            ...n,
            data: { 
              ...n.data, 
              fields: newFields,
              voiceName: currentNode.type === 'persona' ? detectedVoice : n.data.voiceName
            }
          } : n));
        } catch (e) {
          console.error("Failed to parse fields", e);
        }
      }
    } catch (error) {
      console.error("Workflow error:", error);
      alert("An error occurred while running the workflow.");
    } finally {
      setIsWorkflowRunning(false);
    }
  };

  const handleRunWorkflowClick = () => {
    if (edges.length === 0) {
      alert("Please connect at least 2 nodes to create a workflow.");
      return;
    }
    executeSmartWorkflow();
  };

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => {
      const personaCount = nds.filter(n => n.type === 'persona').length;
      const validChanges = changes.filter((change: any) => {
        if (change.type === 'remove') {
          const node = nds.find(n => n.id === change.id);
          if (node?.type === 'persona' && personaCount <= 1) {
            return false;
          }
        }
        return true;
      });
      return applyNodeChanges(validChanges, nds);
    }),
    []
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: any) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      const isSourceEmpty = !(sourceNode?.data?.content as string) || (sourceNode.data.content as string).trim() === '';
      
      // We allow target to be empty to support "generating" into an empty node
      if (isSourceEmpty) {
        setSnackbarMessage("Cannot connect from an empty node. Please add content to the source node first.");
        setTimeout(() => setSnackbarMessage(null), 3500);
        return;
      }

      setEdges((eds) => addEdge({ ...params, type: 'default' }, eds));
    },
    [nodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: {
          label: label,
          content: '',
          fields: {}
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition],
  );

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    try {
      const { geminiService } = await import('./services/geminiService');
      const response = await geminiService.thinkingTask(`Context: We are building a user persona. Current nodes: ${JSON.stringify(nodes.map(n => n.data.label))}. User question: ${userMsg}`);

      setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="w-full h-full bg-ink-2 flex relative">
      {/* Node Palette Toggle */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="p-2 rounded-lg backdrop-blur-md bg-ink-3/90 border border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30 transition-colors shadow-lg"
          title={paletteOpen ? "Hide Node Palette" : "Show Node Palette"}
        >
          {paletteOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* Node Palette */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: 280, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            className="border-r border-rule bg-ink-3/50 backdrop-blur-sm flex flex-col z-10 overflow-hidden"
          >
            <div className="p-4 pt-16 flex flex-col gap-4 h-full overflow-y-auto w-[280px]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cream/40 mb-2">Node Palette</div>
              <div className="text-xs text-cream/50 mb-4 italic font-serif">Drag nodes onto the canvas to build your persona.</div>

              {NODE_TYPES_LIST.map((node) => (
                <div
                  key={node.type}
                  className="p-3 border border-rule hover:border-rule-2 rounded-lg bg-ink-2 cursor-grab active:cursor-grabbing flex flex-col gap-1.5 transition-colors group"
                  onDragStart={(e) => onDragStart(e, node.type, node.label)}
                  draggable
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${node.color}`} />
                    <span className="font-sans text-sm text-cream/80 group-hover:text-cream transition-colors">{node.label}</span>
                  </div>
                  <div className="text-[10px] text-cream/40 pl-5 leading-relaxed">
                    {node.description}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-ink"
        >
          <Background color="rgba(255,255,255,0.05)" gap={32} size={1} />
          <Controls className="!bg-ink-2 !border !border-rule-2 !rounded-lg !overflow-hidden !shadow-2xl" />
        </ReactFlow>

        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`px-4 py-2 rounded-lg backdrop-blur-md border transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest ${sidebarOpen ? 'bg-node-persona/20 border-node-persona/50 text-node-persona' : 'bg-ink-3/90 border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30'}`}
          >
            <Brain size={14} />
            Assistant
          </button>
        </div>

        {/* Bottom Bar for Run Workflow */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={handleRunWorkflowClick}
            disabled={isWorkflowRunning || edges.length === 0}
            className={`px-6 py-3 rounded-full backdrop-blur-md border transition-all flex items-center gap-3 text-sm font-sans font-medium shadow-2xl ${isWorkflowRunning ? 'bg-node-idea/20 border-node-idea/50 text-node-idea cursor-wait' : edges.length === 0 ? 'bg-ink-3/50 border-rule text-cream/30 cursor-not-allowed' : 'bg-ink-3/90 border-rule-2 text-cream hover:text-node-idea hover:border-node-idea/50'}`}
          >
            {isWorkflowRunning ? (
              <Sparkles size={16} className="animate-pulse" />
            ) : (
              <Play size={16} fill="currentColor" className={edges.length === 0 ? 'opacity-50' : ''} />
            )}
            {isWorkflowRunning ? 'Running Workflow...' : 'Run Workflow'}
          </button>
        </div>

        {/* Node Detail Panel */}
        <AnimatePresence>
          {detailNodeId && (
            <NodeDetailPanel
              nodeId={detailNodeId}
              onClose={() => setDetailNodeId(null)}
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
            />
          )}
        </AnimatePresence>

        {/* Snackbar */}
        <AnimatePresence>
          {snackbarMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className="absolute bottom-24 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-3 border border-node-tension/50 shadow-2xl text-cream text-sm max-w-md w-max"
            >
              <div className="w-2 h-2 rounded-full bg-node-tension animate-pulse" />
              <span>{snackbarMessage}</span>
              <button
                onClick={() => setSnackbarMessage(null)}
                className="ml-2 text-cream-dim hover:text-cream transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Assistant Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-rule bg-ink-2 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-rule flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="text-node-persona" size={20} />
                <h3 className="font-display text-lg tracking-widest text-cream">Persona Assistant</h3>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-cream-dim hover:text-cream transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-cream-dim text-sm mt-10 font-serif italic">
                  Ask me to analyze the canvas, find contradictions, or suggest next steps.
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-white/5 ml-8' : 'bg-node-persona/10 border border-node-persona/20 mr-8'}`}>
                  {msg.text}
                </div>
              ))}
              {isThinking && (
                <div className="p-3 rounded-xl text-sm bg-node-persona/10 border border-node-persona/20 mr-8 flex items-center gap-2 text-node-persona">
                  <Sparkles size={14} className="animate-pulse" /> Thinking deeply...
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 border-t border-rule">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask the assistant..."
                  className="w-full bg-ink-3 border border-rule-2 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:border-node-persona/50"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-cream-dim hover:text-node-persona">
                  <MessageSquare size={16} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
