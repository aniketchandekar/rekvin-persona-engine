import { Handle, Position, useReactFlow, useNodes, useEdges } from '@xyflow/react';
import { Zap, Trash2, Info, X, Upload, Save, Maximize2, Brain, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const nodeStyles = {
  idea: 'border-node-idea/30 bg-ink-2',
  persona: 'border-node-persona/30 bg-ink-2',
  customInput: 'border-node-input/30 bg-ink-2',
  research: 'border-node-research/30 bg-ink-2',
  scene: 'border-node-scene/30 bg-ink-2',
  journey: 'border-node-journey/30 bg-ink-2',
  tension: 'border-node-tension/30 bg-ink-2',
  assume: 'border-node-assume/30 bg-ink-2',
  question: 'border-node-question/30 bg-ink-2',
};

const dotColors = {
  idea: 'bg-node-idea',
  persona: 'bg-node-persona',
  customInput: 'bg-node-input',
  research: 'bg-node-research',
  scene: 'bg-node-scene',
  journey: 'bg-node-journey',
  tension: 'bg-node-tension',
  assume: 'bg-node-assume',
  question: 'bg-node-question',
};

const nodeDescriptions: Record<keyof typeof nodeStyles, string> = {
  idea: "Use this node to capture core concepts, product ideas, or main themes.",
  assume: "Document assumptions you are making about the user or market that need validation.",
  customInput: "Represents raw data, user quotes, or direct feedback from interviews.",
  research: "Store findings from web searches, market research, or competitor analysis.",
  scene: "Describe the context or environment where the user experiences the problem.",
  journey: "Map out a step in the user's process or workflow.",
  tension: "Highlight pain points, frustrations, or conflicts the user faces.",
  persona: "Synthesize findings into a distinct user archetype or character.",
  question: "Note open questions or areas where more research is needed."
};

export function BaseNode({ data, type, id }: { data: any, type: keyof typeof nodeStyles, id: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingFields, setIsGeneratingFields] = useState(false);
  const [editContent, setEditContent] = useState(data.content);
  const [showInfo, setShowInfo] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { setNodes, setEdges } = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();

  const personaCount = nodes.filter(n => n.type === 'persona').length;
  const isLastPersonaNode = type === 'persona' && personaCount <= 1;

  // --- Persona Quality Score Logic ---
  let personaScoreUI = null;
  let currentScoreData: any = null;

  if (type === 'persona') {
    const connectedEdges = edges.filter(e => e.target === id || e.source === id);
    const connectedNodeIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
    connectedNodeIds.delete(id); // remove self
    const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));

    const numConnected = connectedNodes.length;
    const uniqueTypes = new Set(connectedNodes.map(n => n.type)).size;

    // 1. Evidence Coverage (25)
    let evidenceScore = 0;
    if (numConnected >= 5) evidenceScore = 25;
    else if (numConnected >= 3) evidenceScore = 18;
    else if (numConnected >= 1) evidenceScore = 10;

    // 2. Source Diversity (20)
    let diversityScore = 0;
    if (uniqueTypes >= 3) diversityScore = 20;
    else if (uniqueTypes === 2) diversityScore = 10;
    else if (uniqueTypes === 1) diversityScore = 5;

    // 3. Behavioral Specificity (20)
    let specificityScore = 0;
    if (data.content && data.content !== 'Double click to edit content...') {
      const contentLen = data.content.length;
      if (contentLen > 100) specificityScore += 15;
      else if (contentLen > 40) specificityScore += 10;
      else if (contentLen > 10) specificityScore += 5;

      if (/\d/.test(data.content) || /because|when|needs|always|never|must|should/i.test(data.content)) {
        specificityScore += 5;
      }
    }
    specificityScore = Math.min(20, specificityScore);

    // 4. Research Grounding (20)
    let researchScore = 0;
    const hasResearchOrInput = connectedNodes.some(n => n.type === 'research' || n.type === 'customInput');
    const hasAssume = connectedNodes.some(n => n.type === 'assume');
    if (hasResearchOrInput) researchScore = 20;
    else if (hasAssume) researchScore = 10;

    // 5. Tension Resolution (15)
    let tensionScore = 0;
    const hasTension = connectedNodes.some(n => n.type === 'tension');
    const hasIdea = connectedNodes.some(n => n.type === 'idea');
    if (hasTension && hasIdea) tensionScore = 15;
    else if (hasTension && !hasIdea) tensionScore = 0;
    else tensionScore = 10; // No tension, neutral

    let totalScore = evidenceScore + diversityScore + specificityScore + researchScore + tensionScore;

    // If nothing is connected, score is 0
    if (numConnected === 0) {
      totalScore = 0;
      evidenceScore = 0;
      diversityScore = 0;
      specificityScore = 0;
      researchScore = 0;
      tensionScore = 0;
    }

    let signalLabel = '';
    let signalColor = '';
    let signalBgColor = '';
    if (totalScore <= 30) {
      signalLabel = '⚠️ Lightly Evidenced';
      signalColor = 'text-red-400';
      signalBgColor = 'bg-red-400';
    } else if (totalScore <= 59) {
      signalLabel = '🔶 Developing';
      signalColor = 'text-orange-400';
      signalBgColor = 'bg-orange-400';
    } else if (totalScore <= 79) {
      signalLabel = '🟡 Reasonably Grounded';
      signalColor = 'text-yellow-400';
      signalBgColor = 'bg-yellow-400';
    } else {
      signalLabel = '✅ Well Evidenced';
      signalColor = 'text-green-400';
      signalBgColor = 'bg-green-400';
    }

    // Find biggest gap
    const gaps = [
      { name: 'Evidence Coverage', gap: 25 - evidenceScore, action: 'Connect more nodes to provide broader evidence for this persona.' },
      { name: 'Source Diversity', gap: 20 - diversityScore, action: 'Connect different types of nodes (e.g., Research, Inputs) to cross-validate.' },
      { name: 'Behavioral Specificity', gap: 20 - specificityScore, action: 'Add more concrete, testable details and behaviors to the persona description.' },
      { name: 'Research Grounding', gap: 20 - researchScore, action: 'Connect Research or Input nodes to ground this persona in real data.' },
      { name: 'Tension Resolution', gap: 15 - tensionScore, action: 'Connect an Idea node to resolve the connected Tension nodes.' }
    ];

    gaps.sort((a, b) => b.gap - a.gap);
    const topAction = gaps[0].gap > 0 ? gaps[0].action : 'Review and refine details to maintain high quality.';

    currentScoreData = {
      totalScore,
      signalLabel,
      signalColor,
      signalBgColor,
      topAction
    };

    personaScoreUI = (
      <div className="mt-4 pt-3 border-t border-rule-2/50 flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-mono text-cream/50 uppercase tracking-wider">Quality Score</span>
          <span className={`text-lg font-display ${signalColor}`}>{totalScore}<span className="text-xs text-cream/30">/100</span></span>
        </div>

        <div className="h-1.5 w-full bg-ink-3 rounded-full overflow-hidden">
          <div
            className={`h-full ${signalBgColor} transition-all duration-500 ease-out`}
            style={{ width: `${totalScore}%` }}
          />
        </div>

        <div className={`text-[11px] font-medium ${signalColor} mb-1`}>
          {signalLabel}
        </div>

        <div className="text-[10px] leading-snug text-cream/60 bg-white/5 p-2 rounded-md border border-white/5">
          <span className="font-bold text-cream/80">To improve:</span> {topAction}
        </div>
      </div>
    );
  }
  // --- End Persona Quality Score Logic ---

  const handleSavePersona = () => {
    if (type !== 'persona' || !currentScoreData) return;

    const event = new CustomEvent('save-persona', {
      detail: {
        id,
        data,
        scoreData: currentScoreData
      }
    });
    window.dispatchEvent(event);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    try {
      const { geminiService } = await import('../services/geminiService');
      const textToSummarize = `Summarize this in 5 words: ${data.content}`;
      const result = await geminiService.fastResponse(textToSummarize);
      setSummary(result);
    } catch (error) {
      console.error("Summarize error:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditContent(`Analyzing ${file.name}...`);
    setIsEditing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const { geminiService } = await import('../services/geminiService');
        const prompt = `Extract the key information from this document that is relevant for a '${type}' node in a user persona/journey map. Keep it concise and summarize the core points.`;

        const analysis = await geminiService.analyzeDocument(base64, file.type, prompt);

        setEditContent(analysis);
        handleContentBlur(analysis);
      } catch (error) {
        console.error("Upload error:", error);
        setEditContent(`Error processing ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContentBlur = async (overrideContent?: string) => {
    setIsEditing(false);
    let finalContent = typeof overrideContent === 'string' ? overrideContent : editContent;
    if (finalContent.trim() === '') {
      finalContent = '';
    }

    // Optimistically update the content
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              content: finalContent,
            },
          };
        }
        return node;
      })
    );

    // If content changed, regenerate the fields (and voice for personas)
    if (finalContent !== data.content) {
      setIsGeneratingFields(true);
      try {
        const { geminiService } = await import('../services/geminiService');
        
        // 1. Regenerate fields
        const fieldsResult = await geminiService.generateFields(type, finalContent);
        const newFields = JSON.parse(fieldsResult);

        // 2. If persona, detect voice
        let detectedVoice = data.voiceName;
        if (type === 'persona') {
          // Detect voice based on name (data.label) and new content
          detectedVoice = await geminiService.detectPersonaVoice(data.label, finalContent);
        }

        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  fields: newFields,
                  voiceName: type === 'persona' ? detectedVoice : node.data.voiceName,
                },
              };
            }
            return node;
          })
        );
      } catch (error) {
        console.error("Failed to update node metadata:", error);
      } finally {
        setIsGeneratingFields(false);
      }
    }
  };

  const handleDelete = () => {
    if (isLastPersonaNode) return;
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  };

  return (
    <>
      <div className={`px-4 py-3 rounded-xl border ${nodeStyles[type]} min-w-[200px] max-w-[250px] shadow-lg relative overflow-visible group hover:border-rule-2 transition-colors`}>
        <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-rule-2 border-none" />

        {/* Floating Action Buttons (visible on hover) */}
        <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-node-details', { detail: { id } }))}
            className="p-1.5 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-cream hover:bg-white/10 shadow-md transition-all"
            title="View Details & Insights"
          >
            <Maximize2 size={12} />
          </button>
          {type === 'persona' && (
            <button
              onClick={handleSavePersona}
              className={`p-1.5 rounded-full border shadow-md transition-all ${isSaved ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-ink-3 border-rule-2 text-cream-dim hover:text-node-persona hover:bg-white/10'}`}
              title={isSaved ? "Saved!" : "Save Persona"}
            >
              <Save size={12} />
            </button>
          )}
          <label
            className="p-1.5 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-cream hover:bg-white/10 shadow-md transition-all cursor-pointer flex items-center justify-center"
            title="Upload Document"
          >
            <Upload size={12} />
            <input type="file" className="hidden" accept=".pdf,image/*,.txt,.csv" onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleSummarize}
            className={`p-1.5 rounded-full border shadow-md transition-all ${isSummarizing ? 'bg-node-idea/20 border-node-idea/50 text-node-idea animate-pulse' : 'bg-ink-3 border-rule-2 text-cream-dim hover:text-node-idea hover:bg-white/10'}`}
            title="Fast Summarize (Flash-Lite)"
          >
            <Zap size={12} />
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="p-1.5 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-cream hover:bg-white/10 shadow-md transition-all"
            title="Node Info"
          >
            <Info size={12} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isLastPersonaNode}
            className={`p-1.5 rounded-full border shadow-md transition-all ${isLastPersonaNode ? 'bg-ink-3 border-rule-2 text-cream-dim/30 cursor-not-allowed' : 'bg-ink-3 border-rule-2 text-cream-dim hover:text-node-tension hover:bg-node-tension/10'}`}
            title={isLastPersonaNode ? "Cannot delete the last Persona node" : "Delete Node"}
          >
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColors[type]}`} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-cream/35">{type} Node</span>
          </div>
        </div>

        <div className="font-display text-lg tracking-wider text-cream mb-2">{data.label}</div>

        {summary ? (
          <div className="text-xs text-node-idea font-mono leading-relaxed mb-3 p-2 bg-node-idea/10 rounded-md">
            {summary}
          </div>
        ) : isEditing ? (
          <textarea
            value={editContent}
            onChange={handleContentChange}
            onBlur={() => handleContentBlur()}
            autoFocus
            className="w-full bg-ink-3 border border-rule-2 rounded-md p-2 text-xs text-cream/80 focus:outline-none focus:border-node-idea/50 resize-none min-h-[60px] mb-3"
          />
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            className="text-xs text-cream/45 leading-relaxed mb-3 cursor-text hover:bg-white/5 p-1 -mx-1 rounded transition-colors"
            title="Double-click to edit"
          >
            {data.content || 'Double click to edit content...'}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {isGeneratingFields ? (
            <div className="flex items-center gap-2 text-[11px] text-cream/40 bg-ink-3 px-2.5 py-1.5 rounded-md animate-pulse">
              <span className="font-mono text-[10px] shrink-0 pt-px">...</span>
              <span className="leading-snug">Updating stats...</span>
            </div>
          ) : (
            <>
              {Object.entries(data.fields || {}).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-[11px] text-cream/40 bg-ink-3 px-2.5 py-1.5 rounded-md">
                  <span className={`font-mono text-[10px] shrink-0 pt-px ${dotColors[type].replace('bg-', 'text-')}`}>{key}</span>
                  <span className="leading-snug break-all">{value as string}</span>
                </div>
              ))}
              
              {type === 'persona' && (
                <div className="flex items-center gap-2 text-[11px] text-cream/40 bg-ink-3 px-2.5 py-1.5 rounded-md border border-node-persona/20">
                  <span className="font-mono text-[10px] shrink-0 pt-px text-node-persona">VOICE</span>
                  <select 
                    value={data.voiceName || 'Puck'}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((node) => {
                          if (node.id === id) {
                            return {
                              ...node,
                              data: { ...node.data, voiceName: e.target.value },
                            };
                          }
                          return node;
                        })
                      );
                    }}
                    className="bg-transparent text-cream/60 outline-none cursor-pointer hover:text-cream transition-colors w-full"
                  >
                    {[
                      'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 
                      'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 
                      'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Pulcherrima', 
                      'Puck', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 
                      'Umbriel', 'Vindemiatrix', 'Zephyr', 'Zubenelgenubi'
                    ].sort().map(v => (
                      <option key={v} value={v} className="bg-ink-2">{v}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {personaScoreUI}

        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${dotColors[type]} opacity-50`} />

        <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-rule-2 border-none" />
      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
            className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-ink-2 border border-rule-2 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className={`h-1 w-full ${dotColors[type]}`} />
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-display text-sm tracking-widest text-cream uppercase">{type} Node</h4>
                <button
                  onClick={() => setShowInfo(false)}
                  className="text-cream-dim hover:text-cream transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-cream/60 leading-relaxed">
                {nodeDescriptions[type]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SessionNode({ id, data }: { id: string, data: any }) {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div className="px-4 py-3 rounded-xl border border-node-idea/30 bg-ink-2 shadow-lg min-w-[200px] relative group">
      <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-node-tension hover:bg-node-tension/10 shadow-md transition-all"
          title="Delete Node"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Brain size={16} className="text-node-idea" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-cream/35">Session</span>
      </div>
      <div className="font-display text-sm tracking-wider text-cream">{data.personaLabel}</div>
      <div className="text-xs text-cream-dim truncate">{data.targetUrl}</div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-rule-2 border-none" />
    </div>
  );
}

function MetricNode({ id, data }: { id: string, data: any }) {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  let parsedResult = null;
  if (data.result && data.result.trim().startsWith('{')) {
    try {
      parsedResult = JSON.parse(data.result);
    } catch (e) {
      console.error("Failed to parse metric result", e);
    }
  }

  return (
    <div className="px-5 py-4 rounded-xl border border-node-tension/30 bg-ink-2 shadow-lg min-w-[240px] max-w-[300px] relative group">
      <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-full bg-ink-3 border border-rule-2 text-cream-dim hover:text-node-tension hover:bg-node-tension/10 shadow-md transition-all"
          title="Delete Node"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 pr-4">
        <BarChart3 size={16} className="text-node-tension flex-shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-cream/35 break-words whitespace-normal leading-none">{data.label}</span>
      </div>

      {!data.result && (
        <div className="text-xs text-cream/70 leading-relaxed italic border-l-2 border-rule-2 pl-3 py-1">
          {data.description}
        </div>
      )}

      {data.result && (
        <div className="mt-2 space-y-3">
          {parsedResult ? (
            <>
              <div className="text-2xl font-medium text-node-tension tracking-tight">
                {parsedResult.value}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] text-cream/80 leading-relaxed">
                  {parsedResult.details}
                </div>
                <div className="text-[11px] text-cream-dim leading-relaxed italic border-t border-rule-2 pt-2 mt-1">
                  {parsedResult.verdict}
                </div>
              </div>
            </>
          ) : (
            <div className={`text-sm leading-relaxed ${data.result.includes('...') ? 'text-cream/50 animate-pulse' : 'text-node-tension'}`}>
              {data.result}
            </div>
          )}
        </div>
      )}
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-rule-2 border-none" />
    </div>
  );
}

export const nodeTypes = {
  idea: (props: any) => <BaseNode {...props} type="idea" />,
  persona: (props: any) => <BaseNode {...props} type="persona" />,
  customInput: (props: any) => <BaseNode {...props} type="customInput" />,
  research: (props: any) => <BaseNode {...props} type="research" />,
  scene: (props: any) => <BaseNode {...props} type="scene" />,
  journey: (props: any) => <BaseNode {...props} type="journey" />,
  tension: (props: any) => <BaseNode {...props} type="tension" />,
  assume: (props: any) => <BaseNode {...props} type="assume" />,
  question: (props: any) => <BaseNode {...props} type="question" />,
  session: SessionNode,
  metric: MetricNode,
};
