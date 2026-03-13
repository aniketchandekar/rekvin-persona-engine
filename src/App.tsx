import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, FilePlus2, MessageSquare, Plus, Save, Trash2, ArrowRight, Play, Layout, Sparkles, Send, Search, Download, CheckCircle2, ChevronRight, X, AlertCircle, BarChart3, Presentation, Target, UserCircle, Wand2, RefreshCw, BoxSelect, Terminal, FileCode2, Globe, Lightbulb, Mic, Square, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  const [personaSubTab, setPersonaSubTab] = useState<'guided' | 'free' | 'saved'>('guided');
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
        <div className="h-10 border-b border-rule bg-ink-2/80 backdrop-blur-md flex items-end px-12 z-40">
          <div className="flex gap-6 h-full">
            <button onClick={() => setPersonaSubTab('guided')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center gap-1.5 border-b-2 px-1 ${personaSubTab === 'guided' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>
              {personaSubTab === 'guided' && <Sparkles size={10} className="animate-pulse" />}
              Guided
            </button>
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
        </div>
      )}

      {/* Sub Nav for Testing */}
      {mainTab === 'testing' && (
        <div className="h-10 border-b border-rule bg-ink-2/80 backdrop-blur-md flex items-end px-12 z-40">
          <div className="flex gap-6 h-full">
            <button onClick={() => setTestingSubTab('simulation')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center border-b-2 px-1 ${testingSubTab === 'simulation' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>Simulation</button>
            <button onClick={() => setTestingSubTab('saved')} className={`text-[10px] uppercase tracking-widest transition-all h-full flex items-center gap-1.5 border-b-2 px-1 ${testingSubTab === 'saved' ? 'border-node-idea text-node-idea' : 'border-transparent text-cream-dim hover:text-cream hover:border-cream/30'}`}>
              Saved Sessions
              {allSessions.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${testingSubTab === 'saved' ? 'bg-node-idea/20 text-node-idea' : 'bg-ink-3 text-cream-dim'}`}>{allSessions.length}</span>}
            </button>
          </div>
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
          ) : personaSubTab === 'guided' ? (
            <motion.div
              key="guided"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 flex"
            >
              <GuidedInterview />
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

function GuidedInterview() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [displayQuestion, setDisplayQuestion] = useState('What are you building?');
  const [options, setOptions] = useState<string[]>([
    'A productivity app',
    'A marketplace',
    'A creative tool',
    'A data dashboard'
  ]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState<{ title: string, uri: string }[]>([]);

  const SHUFFLING_WORDS = ['building?', 'designing?', 'testing?', 'creating?', 'researching?'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (messages.length > 0) return;
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % SHUFFLING_WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  const handleSend = async (textOverride?: string) => {
    const text = typeof textOverride === 'string' ? textOverride : inputText;
    if (!text.trim() || isThinking) return;

    setInputText('');
    setOptions([]);

    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsThinking(true);
    try {
      const { geminiService } = await import('./services/geminiService');
      const history = messages.map(m => `${m.role}: ${m.text}`).join('\n');
      const prompt = `Conversation history:\n${history}\nuser: ${text}`;

      const resultStr = await geminiService.generateInterviewTurn(prompt);
      const result = JSON.parse(resultStr);

      setMessages(prev => [...prev, { role: 'ai', text: result.question }]);
      setDisplayQuestion(result.question);
      setOptions(result.options || []);
    } catch (error) {
      console.error("Error sending text:", error);
      const fallback = "Could you elaborate on that?";
      setMessages(prev => [...prev, { role: 'ai', text: fallback }]);
      setDisplayQuestion(fallback);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSearchWeb = async () => {
    if (isThinking) return;

    const query = inputText.trim() || displayQuestion;

    setInputText('');
    setOptions([]);
    setIsThinking(true);

    try {
      const { geminiService } = await import('./services/geminiService');
      const searchResult = await geminiService.searchGrounding(query);

      const chunks = searchResult.chunks;
      const webResults = chunks
        .filter((c: any) => c.web)
        .map((c: any) => ({
          title: c.web.title,
          uri: c.web.uri,
        }));

      if (webResults.length > 0) {
        setSearchResults(webResults);
        setShowSearchModal(true);
      } else {
        // Fallback if no web results
        setMessages(prev => [...prev, { role: 'user', text: `(Searched Web: ${query})` }]);
        const history = messages.map(m => `${m.role}: ${m.text}`).join('\n');
        const prompt = `Conversation history:\n${history}\nuser searched web for: ${query}\nWeb search result: ${searchResult.text.substring(0, 500)}...\n\nBased on this search result, ask the next logical question to uncover their assumptions, context, or user behaviors. Keep it brief (1-2 sentences).`;

        const resultStr = await geminiService.generateInterviewTurn(prompt);
        const result = JSON.parse(resultStr);

        setMessages(prev => [...prev, { role: 'ai', text: result.question }]);
        setDisplayQuestion(result.question);
        setOptions(result.options || []);
      }
    } catch (error) {
      console.error("Error searching web:", error);
      const fallback = "I couldn't find a good answer on the web. What do you think?";
      setMessages(prev => [...prev, { role: 'ai', text: fallback }]);
      setDisplayQuestion(fallback);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSelectSearchResult = async (result: { title: string, uri: string }) => {
    setShowSearchModal(false);
    const text = `I found this: ${result.title}`;
    await handleSend(text);
  };

  const handleGenerateIdea = async () => {
    if (isThinking) return;
    setIsThinking(true);
    try {
      const { geminiService } = await import('./services/geminiService');
      const idea = await geminiService.fastResponse("Generate a single, creative, and specific app or product idea in one short sentence. Do not include quotes. For example: A marketplace for local home-cooked meals.");
      setInputText(idea.trim());
    } catch (error) {
      console.error("Error generating idea:", error);
    } finally {
      setIsThinking(false);
    }
  };

  const currentQuestion = displayQuestion;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div className="text-center min-h-[120px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex items-center justify-center gap-2 text-node-idea"
              >
                <Sparkles size={20} className="animate-pulse" />
                <span className="font-serif italic text-lg tracking-wide">Synthesizing...</span>
              </motion.div>
            ) : messages.length === 0 ? (
              <motion.div
                key="shuffling-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-3xl max-w-xl mx-auto flex flex-wrap justify-center gap-2 items-center"
              >
                <span className="font-sans font-semibold tracking-tight text-cream">What are you</span>
                <div className="relative h-10 w-48 flex items-center justify-start overflow-hidden ml-1">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={wordIndex}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                      transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
                      className="absolute font-serif italic text-node-idea"
                    >
                      {SHUFFLING_WORDS[wordIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentQuestion}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="font-serif text-2xl italic text-cream/90 leading-relaxed max-w-xl mx-auto"
              >
                "{currentQuestion}"
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!isThinking && options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-center gap-3 mb-4"
          >
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSend(opt)}
                className="px-5 py-2.5 rounded-full border border-rule-2 bg-ink-3 text-cream/70 text-sm hover:bg-white/5 hover:border-cream/30 hover:text-cream transition-all"
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}

        <div className="relative flex items-center max-w-md mx-auto w-full">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            disabled={isThinking}
            placeholder={isThinking ? "Wait for the next question..." : "Or type your own answer..."}
            className="w-full bg-white/5 border border-rule-2 rounded-lg py-3 pl-4 pr-12 font-sans text-sm text-cream/40 focus:outline-none focus:border-node-idea/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={() => handleSend()}
              disabled={isThinking || !inputText.trim()}
              className="p-2 text-cream/40 hover:text-node-idea transition-colors disabled:opacity-30 disabled:hover:text-cream/40"
              title="Send text"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {!isThinking && (
          <div className="flex justify-center mt-2">
            {messages.length === 0 ? (
              <button
                onClick={handleGenerateIdea}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rule-2 bg-ink-3/50 text-cream-dim text-xs hover:bg-white/5 hover:text-cream hover:border-cream/30 transition-all"
              >
                <Lightbulb size={14} />
                <span>Generate an idea</span>
              </button>
            ) : (
              <button
                onClick={handleSearchWeb}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-rule-2 bg-ink-3/50 text-cream-dim text-xs hover:bg-white/5 hover:text-cream hover:border-cream/30 transition-all"
              >
                <Globe size={14} />
                <span>Not sure? Search the web</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Results Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-ink-2 border border-rule-2 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <Search className="text-node-idea" size={20} />
                  <h3 className="font-display text-xl tracking-widest text-cream">Web Results</h3>
                </div>
                <button onClick={() => setShowSearchModal(false)} className="text-cream-dim hover:text-cream">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSearchResult(result)}
                    className="flex flex-col gap-2 p-4 rounded-xl border border-rule bg-ink-3 hover:border-node-idea/50 hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="font-sans text-sm text-cream group-hover:text-node-idea transition-colors">
                      {result.title}
                    </div>
                    <div className="text-xs font-mono text-cream-dim truncate w-full">
                      {result.uri}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

  const findFlows = useCallback(() => {
    // Find all paths of length >= 2
    const adjacencyList = new Map<string, string[]>();
    edges.forEach(edge => {
      if (!adjacencyList.has(edge.source)) adjacencyList.set(edge.source, []);
      adjacencyList.get(edge.source)!.push(edge.target);
    });

    const flows: { id: string, nodes: Node[] }[] = [];
    const inDegree = new Map<string, number>();
    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1));

    // Start from nodes with in-degree 0
    const startNodes = nodes.filter(n => inDegree.get(n.id) === 0);

    startNodes.forEach(startNode => {
      const paths: Node[][] = [];
      const dfs = (currentId: string, currentPath: Node[]) => {
        const node = nodes.find(n => n.id === currentId);
        if (!node) return;

        const newPath = [...currentPath, node];
        const neighbors = adjacencyList.get(currentId) || [];

        if (neighbors.length === 0) {
          if (newPath.length >= 2) {
            paths.push(newPath);
          }
        } else {
          neighbors.forEach(neighbor => dfs(neighbor, newPath));
        }
      };
      dfs(startNode.id, []);

      paths.forEach((path, index) => {
        flows.push({ id: `flow-${startNode.id}-${index}`, nodes: path });
      });
    });

    return flows;
  }, [nodes, edges]);

  const hasFlows = useMemo(() => findFlows().length > 0, [findFlows]);

  const handleRunWorkflowClick = () => {
    const flows = findFlows();
    if (flows.length === 0) {
      alert("Please connect at least 2 nodes to create a workflow.");
      return;
    }
    if (flows.length === 1) {
      executeFlow(flows[0].nodes);
    } else {
      setAvailableFlows(flows);
      setShowFlowSelector(true);
    }
  };

  const executeFlow = async (flowNodes: Node[]) => {
    setShowFlowSelector(false);
    setIsWorkflowRunning(true);

    try {
      const { geminiService } = await import('./services/geminiService');

      // We iterate through the flow, updating each node based on the previous one
      // We need to keep track of the updated content to pass to the next node
      let previousContent = flowNodes[0].data.content as string;

      for (let i = 1; i < flowNodes.length; i++) {
        const currentNode = flowNodes[i];

        // Indicate that this node is currently generating
        setNodes(nds => nds.map(n => n.id === currentNode.id ? {
          ...n,
          data: { ...n.data, content: "Generating..." }
        } : n));

        const newContent = await geminiService.runWorkflowNode(currentNode.type, currentNode.data.label as string, previousContent);

        // Update the node with new content
        setNodes(nds => nds.map(n => n.id === currentNode.id ? {
          ...n,
          data: { ...n.data, content: newContent }
        } : n));

        // Also regenerate fields for this node (and voice for personas)
        const newFieldsStr = await geminiService.generateFields(currentNode.type, newContent);
        
        let detectedVoice = currentNode.data.voiceName;
        if (currentNode.type === 'persona') {
          detectedVoice = await geminiService.detectPersonaVoice(currentNode.data.label as string, newContent);
        }

        try {
          const newFields = JSON.parse(newFieldsStr);
          setNodes(nds => nds.map(n => n.id === currentNode.id ? {
            ...n,
            data: { 
              ...n.data, 
              fields: newFields,
              voiceName: currentNode.type === 'persona' ? detectedVoice : n.data.voiceName
            }
          } : n));
        } catch (e) {
          console.error("Failed to parse fields for node", currentNode.id);
        }

        previousContent = newContent;
      }
    } catch (error) {
      console.error("Workflow error:", error);
      alert("An error occurred while running the workflow.");
    } finally {
      setIsWorkflowRunning(false);
    }
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
      const isTargetEmpty = !(targetNode?.data?.content as string) || (targetNode.data.content as string).trim() === '';

      if (isSourceEmpty || isTargetEmpty) {
        setSnackbarMessage("Cannot connect empty nodes. Please add content to both nodes first.");
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
            disabled={isWorkflowRunning || !hasFlows}
            className={`px-6 py-3 rounded-full backdrop-blur-md border transition-all flex items-center gap-3 text-sm font-sans font-medium shadow-2xl ${isWorkflowRunning ? 'bg-node-idea/20 border-node-idea/50 text-node-idea cursor-wait' : !hasFlows ? 'bg-ink-3/50 border-rule text-cream/30 cursor-not-allowed' : 'bg-ink-3/90 border-rule-2 text-cream hover:text-node-idea hover:border-node-idea/50'}`}
          >
            {isWorkflowRunning ? (
              <Sparkles size={16} className="animate-pulse" />
            ) : (
              <Play size={16} fill="currentColor" className={!hasFlows ? 'opacity-50' : ''} />
            )}
            {isWorkflowRunning ? 'Running Workflow...' : 'Run Workflow'}
          </button>
        </div>

        {/* Flow Selector Modal */}
        <AnimatePresence>
          {showFlowSelector && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-ink-2 border border-rule-2 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-display text-xl tracking-widest text-cream">Select Workflow</h3>
                  <button onClick={() => setShowFlowSelector(false)} className="text-cream-dim hover:text-cream">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
                  {availableFlows.map((flow) => (
                    <button
                      key={flow.id}
                      onClick={() => executeFlow(flow.nodes)}
                      className="flex flex-col gap-2 p-4 rounded-xl border border-rule bg-ink-3 hover:border-node-idea/50 hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-cream-dim">Flow ({flow.nodes.length} nodes)</span>
                        <Play size={14} className="text-cream-dim group-hover:text-node-idea transition-colors" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-cream">
                        <span className="truncate max-w-[120px]">{flow.nodes[0].data.label as React.ReactNode}</span>
                        <span className="text-cream-dim">→</span>
                        <span className="truncate max-w-[120px]">{flow.nodes[flow.nodes.length - 1].data.label as React.ReactNode}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
