import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Brain, Play, BarChart3, ChevronRight } from 'lucide-react';

export type OnboardingType = 'personas' | 'testing' | 'metrics';

interface OnboardingModalProps {
    type: OnboardingType;
    onClose: () => void;
}

const CONTENT = {
    personas: {
        title: 'Building Your Personas',
        icon: <Brain className="text-node-persona" size={32} />,
        color: 'border-node-persona',
        steps: [
            {
                title: 'Guided Interview',
                description: 'Talk to Gemini to synthesize a new persona archetype from your product vision.',
                icon: <Sparkles size={18} className="text-node-idea" />
            },
            {
                title: 'Free Build Canvas',
                description: 'Conceptualize ideas, assumptions, and research using our visual node editor.',
                icon: <ChevronRight size={18} />
            },
            {
                title: 'Persona Synthesis',
                description: 'Connect findings to a Persona node to generate a quality-scored archetype.',
                icon: <Brain size={18} className="text-node-persona" />
            }
        ]
    },
    testing: {
        title: 'Multimodal Simulation',
        icon: <Play className="text-node-idea" size={32} />,
        color: 'border-node-idea',
        steps: [
            {
                title: 'Live API Agents',
                description: 'Deploy synthetic agents using the Gemini Multimodal Live API for 1fps real-time vision.',
                icon: <Play size={18} className="text-node-idea" />
            },
            {
                title: 'Voice Narration',
                description: 'Hear the persona narrate its internal monologue and frustrations as it navigates.',
                icon: <ChevronRight size={18} />
            },
            {
                title: 'User Intervention',
                description: 'Talk to the agent during a test to guide it or ask about its specific experience.',
                icon: <Sparkles size={18} className="text-node-idea" />
            }
        ]
    },
    metrics: {
        title: 'Behavioral Metrics Hub',
        icon: <BarChart3 className="text-node-tension" size={32} />,
        color: 'border-node-tension',
        steps: [
            {
                title: 'Session-to-Metric Mapping',
                description: 'Connect session data to metric nodes to calculate quantitative friction and comprehension.',
                icon: <BarChart3 size={18} className="text-node-tension" />
            },
            {
                title: 'Persona-Fit Validation',
                description: 'Determine if the agent\'s behavior matches the persona profile or if recalibration is needed.',
                icon: <Sparkles size={18} className="text-node-idea" />
            },
            {
                title: 'Diagnostic Reports',
                description: 'Generate AI-powered verdicts that identify specific UI bottlenecks and provide expert recommendations.',
                icon: <Brain size={18} className="text-node-tension" />
            }
        ]
    }
};

export function OnboardingModal({ type, onClose }: OnboardingModalProps) {
    const content = CONTENT[type];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-md"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className={`bg-ink-2/95 border ${content.color} rounded-2xl p-8 max-w-xl w-full shadow-2xl relative overflow-hidden`}
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-cream-dim hover:text-cream hover:bg-white/5 transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                            {content.icon}
                        </div>
                        <h2 className="font-display text-2xl tracking-widest text-cream uppercase">{content.title}</h2>
                        <div className="h-0.5 w-12 bg-node-idea mt-3" />
                    </div>

                    <div className="space-y-6 mb-10">
                        {content.steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="flex gap-4 p-4 rounded-xl bg-ink-3/50 border border-white/5 group hover:border-white/10 transition-colors"
                            >
                                <div className="shrink-0 w-10 h-10 rounded-lg bg-ink-2 flex items-center justify-center border border-white/5 text-cream-dim group-hover:text-cream transition-colors">
                                    {step.icon}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-medium text-cream mb-1">{step.title}</h3>
                                    <p className="text-xs text-cream-dim leading-relaxed font-light">{step.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className={`w-full py-4 rounded-xl bg-gradient-to-r from-ink-3 to-ink-2 border ${content.color}/50 text-sm font-medium text-cream hover:from-white/10 hover:to-white/5 transition-all shadow-xl uppercase tracking-widest`}
                    >
                        Got it, Let's go
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
