import { useState, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowProvider, addEdge, applyNodeChanges, applyEdgeChanges, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Brain, BarChart3, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Video, FileText, Play, Sparkles, X, FileSearch, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { nodeTypes } from './CustomNodes';
import { SavedSession } from '../types';

const METRIC_CATEGORIES = ['All', 'Suggested', 'Time', 'Navigation', 'Comprehension', 'Friction', 'Completion', 'Calibration'];

const SUGGESTED_METRICS = [
  'step_time',
  'friction_per_step',
  'flow_completion_rate',
  'abandonment_point'
];

const METRIC_NODES = [
  {
    type: 'step_time',
    label: 'Time-to-completion per journey step',
    description: 'How long the agent spends on each screen before taking an action. Reveals screens where the persona hesitates.',
    category: 'Time'
  },
  {
    type: 'first_action',
    label: 'Time-to-first-meaningful-action',
    description: 'From page load to the first purposeful click. Long time means the entry point isn\'t obvious.',
    category: 'Time'
  },
  {
    type: 'session_vs_patience',
    label: 'Total session duration vs patience',
    description: 'Compares total session time to the persona\'s patience parameter. High duration signals high friction.',
    category: 'Time'
  },
  {
    type: 'dwell_dist',
    label: 'Dwell-time distribution',
    description: 'Identifies bottlenecks where a disproportionate amount of time is spent on a single step.',
    category: 'Time'
  },

  {
    type: 'scroll_depth',
    label: 'Scroll depth before first click',
    description: 'How far the persona scrolls before clicking. High depth means primary actions aren\'t visible above the fold.',
    category: 'Navigation'
  },
  {
    type: 'click_accuracy',
    label: 'Click accuracy rate',
    description: 'Ratio of intentional clicks to total clicks. Low accuracy for low-tech personas signals usability failure.',
    category: 'Navigation'
  },
  {
    type: 'misclick_patterns',
    label: 'Mis-click patterns',
    description: 'Identifies non-interactive elements that look clickable or visually weak CTAs.',
    category: 'Navigation'
  },
  {
    type: 'backtrack_rate',
    label: 'Backtrack rate',
    description: 'Frequency of navigating backward. High backtracking is a strong predictor of abandonment.',
    category: 'Navigation'
  },
  {
    type: 'dead_ends',
    label: 'Dead-end encounters',
    description: 'Moments where the agent reaches a state with no clear forward path given cognitive constraints.',
    category: 'Navigation'
  },

  {
    type: 'vocab_mismatch',
    label: 'Vocabulary mismatch flags',
    description: 'Flags terminology exceeding persona comprehension level. Count of mismatches per journey.',
    category: 'Comprehension'
  },
  {
    type: 'reading_complexity',
    label: 'Reading complexity score',
    description: 'Flesch-Kincaid level of visible copy vs persona ceiling. Identifies screens with comprehension risks.',
    category: 'Comprehension'
  },
  {
    type: 'instruction_following',
    label: 'Instruction-following rate',
    description: 'Measures if the persona follows explicit UI instructions correctly on the first attempt.',
    category: 'Comprehension'
  },
  {
    type: 'error_comprehension',
    label: 'Error message comprehension',
    description: 'Analyzes if subsequent behavior suggests understanding of error messages. Repeated errors signal failure.',
    category: 'Comprehension'
  },

  {
    type: 'friction_per_step',
    label: 'Friction score per step',
    description: 'Composite score (dwell time + mis-clicks + backtracks + vocab mismatches). Ranks the most painful steps for this persona.',
    category: 'Friction'
  },
  {
    type: 'retry_count',
    label: 'Retry count per action',
    description: 'Attempts per action. 1 = minor friction, 3+ = genuine ambiguity for this persona type.',
    category: 'Friction'
  },
  {
    type: 'field_abandonment',
    label: 'Field abandonment in forms',
    description: 'Identifies specific fields skipped or filled incorrectly. Signals confusing labels or missing info.',
    category: 'Friction'
  },
  {
    type: 'rage_signal',
    label: 'Rage-equivalent signal',
    description: 'Clusters of rapid repeated actions in one area. Indicates expected UI responses that never occurred.',
    category: 'Friction'
  },

  {
    type: 'flow_completion_rate',
    label: 'Flow completion rate',
    description: 'Did the persona complete the journey? Binary at the journey level, but more nuanced at the step level — which steps were completed, which were skipped, and which caused abandonment.',
    category: 'Completion'
  },
  {
    type: 'abandonment_point',
    label: 'Abandonment point',
    description: 'The specific step at which the persona gave up. This is your most actionable metric — it tells you exactly where to focus design attention.',
    category: 'Completion'
  },
  {
    type: 'abandonment_reason',
    label: 'Abandonment reason classification',
    description: 'When the agent outputs {"action": "abandon", "reason": "..."}, Gemini classifies the reason into a taxonomy.',
    category: 'Completion'
  },
  {
    type: 'critical_flow_pass',
    label: 'Critical flow pass rate',
    description: 'Of the flows marked as critical in the Journey Node, what percentage did the persona complete? This is your headline metric — the one that answers "is this product ready for this user."',
    category: 'Completion'
  },

  {
    type: 'patience_adherence',
    label: 'Patience threshold adherence',
    description: "Does the agent actually abandon near the persona's defined patience ceiling, or does it complete flows that a real patience-2 user would have abandoned?",
    category: 'Calibration'
  },
  {
    type: 'cognitive_consistency',
    label: 'Cognitive load consistency',
    description: "Does the agent's behavior reflect the defined cognitive load throughout the session? A cognitive-load-3 persona should show consistent moderate hesitation.",
    category: 'Calibration'
  },
  {
    type: 'vocab_consistency',
    label: 'Vocabulary behavior consistency',
    description: "Does the agent actually flag vocabulary it shouldn't know? If a persona with 'no financial vocabulary' breezes through VAT and EBITDA, it needs recalibration.",
    category: 'Calibration'
  },
];

export function MetricsHub({ savedSessions }: { savedSessions: SavedSession[] }) {
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(false);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((nds) => applyEdgeChanges(changes, nds)), []);
  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge(params, eds));
  }, []);

  const handleRunWorkflow = async () => {
    if (edges.length === 0) return;
    // Guard against double-execution (React StrictMode in dev)
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: edges.length });

    try {
      const { geminiService } = await import('../services/geminiService');
      let count = 0;
      // Process sequentially instead of Promise.all to avoid 429 Too Many Requests
      for (const edge of edges) {
        count++;
        setAnalysisProgress({ current: count, total: edges.length });
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          const isSourceSession = sourceNode.type === 'session';
          const isTargetMetric = targetNode.type === 'metric';
          const isSourceMetric = sourceNode.type === 'metric';
          const isTargetSession = targetNode.type === 'session';

          if ((isSourceSession && isTargetMetric) || (isSourceMetric && isTargetSession)) {
            const sessionNode = isSourceSession ? sourceNode : targetNode;
            const metricNode = isSourceMetric ? sourceNode : targetNode;
            await analyzeMetric(geminiService, sessionNode.data, metricNode.data, metricNode.id);

            // Rate limit delay (reduced from 4.5s to 2s for better UX, still safe for most accounts)
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.error(`[Workflow Error] Invalid edge connection between '${sourceNode.type}' and '${targetNode.type}'. Please connect a Session node to a Metric node.`, { edge, sourceNode, targetNode });
          }
        }
      }
    } catch (e: any) {
      console.error("[Workflow Error] Execution failed:", e);
      const is429 = e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED');

      if (is429) {
        setSnackbarMessage("Rate limit exceeded. Please wait a moment and try again.");
      } else {
        setSnackbarMessage("Workflow stopped due to an error.");
      }

      setTimeout(() => setSnackbarMessage(null), 5000);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress({ current: 0, total: 0 });
      isRunningRef.current = false;
    }
  };

  const analyzeMetric = async (geminiService: any, sessionData: any, metricData: any, nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, result: 'Analyzing...' } } : n));

    try {
      const result = await geminiService.analyzeMetric(sessionData, metricData.type, metricData.label);
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, result } } : n));
    } catch (error: any) {
      console.error("Analysis error:", error);
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, result: 'Error analyzing.' } } : n));
      // Throw error to stop the main workflow loop and trigger the snackbar
      throw error;
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setSnackbarMessage("Synthesizing diagnostic report...");

    try {
      const { geminiService } = await import('../services/geminiService');

      const sessionNodes = nodes.filter(n => n.type === 'session');
      const metricNodes = nodes.filter(n => n.type === 'metric' && n.data?.result && !String(n.data.result).startsWith('Analyzing'));

      const sessionData = sessionNodes.map(n => n.data);
      const metricResults = metricNodes.map(n => {
        let parsedResult = n.data.result;
        if (typeof n.data.result === 'string') {
          try {
            // Check if it's already an 'Analyzing' or 'Error' state
            if (n.data.result.startsWith('Analyzing') || n.data.result.startsWith('Error')) {
              return null;
            }
            parsedResult = JSON.parse(n.data.result);
          } catch (e) {
            console.warn(`[Report] Failed to parse result for node ${n.id}:`, n.data.result);
            return null;
          }
        }
        return {
          label: n.data.label,
          type: n.data.type,
          result: parsedResult
        };
      }).filter(Boolean); // Remote invalid or non-parsed results

      const report = await geminiService.generateDiagnosticReport(sessionData, metricResults);
      setDiagnosticReport(report);
      setReportModalOpen(true);
      setSnackbarMessage(null);
    } catch (error) {
      console.error("Report generation error:", error);
      setSnackbarMessage("Failed to generate report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = () => {
    if (!diagnosticReport) return;

    let content = `# Diagnostic Report\n`;
    content += `AI synthesis of metric signals\n\n`;

    if (diagnosticReport.personaFit) {
      content += `## Persona Fit Assessment\n`;
      content += `**Score:** ${diagnosticReport.personaFit.score}\n\n`;
      content += `${diagnosticReport.personaFit.assessment}\n\n`;
    }

    if (diagnosticReport.productFixes && diagnosticReport.productFixes.length > 0) {
      content += `## Product Recommendations\n`;
      diagnosticReport.productFixes.forEach((fix: any) => {
        content += `### [${fix.priority} FIX] ${fix.issue}\n`;
        content += `${fix.recommendation}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic_report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSnackbarMessage("Report downloaded successfully.");
    setTimeout(() => setSnackbarMessage(null), 3000);
  };

  const onDragStart = (e: React.DragEvent, type: string, data: any) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ type, data }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const data = JSON.parse(e.dataTransfer.getData('application/reactflow'));

    if (!reactFlowBounds) return;

    const position = {
      x: e.clientX - reactFlowBounds.left,
      y: e.clientY - reactFlowBounds.top,
    };

    const newNode: Node = {
      id: `${data.type}-${Date.now()}`,
      type: data.type === 'session' ? 'session' : 'metric',
      position,
      data: data.data,
    };

    const isFirstSession = data.type === 'session' && !nodes.some(n => n.type === 'session');
    if (isFirstSession) {
      setSelectedCategory('Suggested');
    }

    setNodes((nds) => nds.concat(newNode));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="absolute inset-0 flex bg-ink" ref={reactFlowWrapper}>
      {/* Left Sidebar Toggle */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className="p-2 rounded-lg backdrop-blur-md bg-ink-3/90 border border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30 transition-colors shadow-lg"
        >
          {leftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* Left Sidebar - Saved Sessions */}
      <AnimatePresence>
        {leftSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: 320, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            className="border-r border-rule bg-ink-2/50 flex flex-col z-10 overflow-hidden shrink-0"
          >
            <div className="p-4 pt-16 border-b border-rule w-[320px]">
              <h3 className="font-display text-sm tracking-widest text-cream uppercase">Saved Sessions</h3>
              <p className="text-xs text-cream-dim mt-1">Drag a session to the canvas</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 w-[320px]">
              {savedSessions.map(session => (
                <div
                  key={session.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, 'session', session)}
                  className={`p-3 rounded-xl border border-rule bg-ink-3 transition-colors cursor-grab active:cursor-grabbing group ${isAnalyzing && nodes.some(n => n.type === 'session' && n.data.id === session.id)
                      ? 'border-node-idea/50 shadow-[0_0_15px_rgba(var(--node-idea-rgb),0.1)]'
                      : 'hover:border-node-idea/50'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Brain
                      size={16}
                      className={`text-node-idea ${isAnalyzing && nodes.some(n => n.type === 'session' && n.data.id === session.id)
                          ? 'animate-pulse'
                          : ''
                        }`}
                    />
                    <span className="text-sm font-medium text-cream">{session.personaLabel}</span>
                  </div>
                  <div className="text-xs text-cream-dim truncate">{session.targetUrl}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges.map(e => ({ ...e, animated: isAnalyzing }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#333" gap={20} />
          <Controls />
          <Panel position="bottom-center" className="mb-8">
            <div className="flex gap-4">
              <button
                onClick={handleRunWorkflow}
                disabled={edges.length === 0 || isAnalyzing}
                className={`px-6 py-3 rounded-full backdrop-blur-md border transition-all flex items-center gap-3 text-sm font-sans font-medium shadow-2xl ${isAnalyzing
                  ? 'bg-node-idea/20 border-node-idea/50 text-node-idea cursor-wait'
                  : edges.length === 0
                    ? 'bg-ink-3/50 border-rule text-cream/30 cursor-not-allowed'
                    : 'bg-ink-3/90 border-rule-2 text-cream hover:text-node-idea hover:border-node-idea/50'
                  }`}
              >
                {isAnalyzing ? (
                  <Sparkles size={16} className="animate-pulse" />
                ) : (
                  <Play size={16} fill="currentColor" className={edges.length === 0 ? 'opacity-50' : ''} />
                )}
                {isAnalyzing
                  ? `Analyzing (${analysisProgress.current}/${analysisProgress.total})...`
                  : 'Run Workflow'}
              </button>

              <button
                onClick={reportModalOpen ? () => setReportModalOpen(false) : handleGenerateReport}
                disabled={isGeneratingReport || !nodes.some(n => n.type === 'metric' && n.data?.result && !String(n.data.result).startsWith('Analyzing'))}
                className={`px-6 py-3 rounded-full backdrop-blur-md border transition-all flex items-center gap-3 text-sm font-sans font-medium shadow-2xl ${isGeneratingReport
                  ? 'bg-node-tension/20 border-node-tension/50 text-node-tension cursor-wait'
                  : !nodes.some(n => n.type === 'metric' && n.data?.result && !String(n.data.result).startsWith('Analyzing'))
                    ? 'bg-ink-3/50 border-rule text-cream/30 cursor-not-allowed hidden'
                    : reportModalOpen
                      ? 'bg-node-tension text-ink border-node-tension'
                      : 'bg-ink-3/90 border-node-tension text-cream hover:text-node-tension hover:bg-node-tension/10'
                  }`}
              >
                {isGeneratingReport ? (
                  <Sparkles size={16} className="animate-pulse" />
                ) : (
                  <FileSearch size={16} className={!nodes.some(n => n.type === 'metric' && n.data?.result) ? 'opacity-50' : ''} />
                )}
                {isGeneratingReport ? 'Synthesizing...' : reportModalOpen ? 'Hide Report' : 'Generate Report'}
              </button>
            </div>
          </Panel>
        </ReactFlow>

        {/* Diagnostic Report Panel Overlay */}
        <AnimatePresence>
          {reportModalOpen && diagnosticReport && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[600px] max-w-[90vw] max-h-[60vh] overflow-y-auto bg-ink-2/95 backdrop-blur-xl border border-node-tension rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl text-cream font-medium flex items-center gap-2">
                    <Brain className="text-node-tension" size={20} />
                    Diagnostic Report
                  </h2>
                  <p className="text-sm text-cream-dim mt-1">AI synthesis of metric signals</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-node-tension/10 text-node-tension border border-node-tension/30 hover:bg-node-tension/20 transition-all text-xs font-medium"
                    title="Download as Markdown"
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button
                    onClick={() => setReportModalOpen(false)}
                    className="p-1 rounded-full text-cream-dim hover:bg-white/5 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Persona Fit Box */}
                <div className="bg-ink-3/50 rounded-xl p-4 border border-rule">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-cream uppercase tracking-wider">Persona Fit Assessment</h3>
                    <div className="px-3 py-1 bg-node-tension/10 text-node-tension rounded-full font-bold text-sm border border-node-tension/20">
                      Score: {diagnosticReport.personaFit?.score || 'N/A'}
                    </div>
                  </div>
                  <p className="text-sm text-cream-dim leading-relaxed">
                    {diagnosticReport.personaFit?.assessment || 'No assessment available.'}
                  </p>
                </div>

                {/* Product Fixes */}
                <div>
                  <h3 className="text-sm font-medium text-cream uppercase tracking-wider mb-4">Product Recommendations</h3>
                  <div className="space-y-3">
                    {diagnosticReport.productFixes?.map((fix: any, index: number) => (
                      <div key={index} className="bg-ink-3 border border-rule rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${fix.priority === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                            fix.priority === 'MED' ? 'bg-orange-500/20 text-orange-300' :
                              'bg-node-idea/20 text-node-idea'
                            }`}>
                            {fix.priority} FIX
                          </span>
                          <span className="text-sm font-medium text-cream">{fix.issue}</span>
                        </div>
                        <p className="text-sm text-cream-dim leading-relaxed pl-[4.5rem]">
                          {fix.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Sidebar - Metric Nodes */}
      <AnimatePresence>
        {rightSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: 20 }}
            animate={{ width: 320, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 20 }}
            className="border-l border-rule bg-ink-2/50 flex flex-col z-10 overflow-hidden shrink-0"
          >
            <div className="p-4 pt-16 border-b border-rule w-[320px]">
              <h3 className="font-display text-sm tracking-widest text-cream uppercase">Metric Nodes</h3>
              <p className="text-xs text-cream-dim mt-1 mb-4">Drag a metric to the canvas</p>

              <div className="flex flex-wrap gap-2">
                {METRIC_CATEGORIES.map(cat => {
                  const isSuggested = cat === 'Suggested';
                  const isDisabled = isSuggested && !nodes.some(n => n.type === 'session');
                  const isActive = selectedCategory === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => !isDisabled && setSelectedCategory(cat)}
                      disabled={isDisabled}
                      className={`px-2 py-1 flex items-center gap-1 rounded-full text-[10px] uppercase tracking-wider border transition-all ${isDisabled
                        ? 'bg-ink-3/50 text-cream/30 border-rule cursor-not-allowed'
                        : isActive
                          ? 'bg-node-tension text-ink border-node-tension cursor-pointer'
                          : isSuggested
                            ? 'bg-node-idea/10 text-node-idea border-node-idea/30 hover:bg-node-idea/20 cursor-pointer'
                            : 'bg-ink-3 text-cream-dim border-rule hover:border-cream-dim/30 cursor-pointer'
                        }`}
                    >
                      {isSuggested && <Sparkles size={10} className={isDisabled ? 'opacity-30' : (isActive ? 'animate-pulse' : '')} />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 w-[320px]">
              {METRIC_NODES
                .filter(m => {
                  if (selectedCategory === 'All') return true;
                  if (selectedCategory === 'Suggested') return SUGGESTED_METRICS.includes(m.type);
                  return m.category === selectedCategory;
                })
                .map(metric => (
                  <div
                    key={metric.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, 'metric', metric)}
                    className="p-3 rounded-xl border border-rule bg-ink-3 hover:border-node-tension/50 cursor-grab active:cursor-grabbing transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-node-tension" />
                        <span className="text-sm font-medium text-cream">{metric.label}</span>
                      </div>
                      <span className="text-[9px] text-cream-dim uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                        {metric.category}
                      </span>
                    </div>
                    <div className="text-xs text-cream-dim leading-relaxed">{metric.description}</div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Sidebar Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          className="p-2 rounded-lg backdrop-blur-md bg-ink-3/90 border border-rule-2 text-cream-dim hover:text-cream hover:border-cream/30 transition-colors shadow-lg"
        >
          {rightSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>

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
    </div >
  );
}
