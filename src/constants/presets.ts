export const PRESET_PERSONAS = [
    {
        id: 'preset-elena',
        data: {
            label: 'Elena (The Fast-Mover)',
            content: 'A 32-year-old marketing executive who is extremely busy and tech-savvy. She values efficiency above all else and has zero patience for slow loading or confusing navigation.',
            fields: {
                tech_literacy: 'High',
                patience: 'Critical/Low',
                focus: 'Fast task completion',
                tone: 'Professional but hurried'
            }
        },
        scoreData: {
            totalScore: 92,
            signalLabel: 'High Quality',
            signalColor: 'text-node-idea',
            signalBgColor: 'bg-node-idea',
            topAction: 'Persona is complete and ready for testing.'
        }
    },
    {
        id: 'preset-arthur',
        data: {
            label: 'Arthur (The Cautious Learner)',
            content: 'A 74-year-old retired librarian. He is new to modern web apps and worries about making mistakes. He reads all labels carefully and prefers clear, step-by-step instructions.',
            fields: {
                tech_literacy: 'Low',
                patience: 'High',
                focus: 'Clarity and Security',
                tone: 'Polite and hesitant'
            }
        },
        scoreData: {
            totalScore: 88,
            signalLabel: 'Consistent',
            signalColor: 'text-node-idea',
            signalBgColor: 'bg-node-idea',
            topAction: 'Detailed profile, good for accessibility testing.'
        }
    },
    {
        id: 'preset-jamie',
        data: {
            label: 'Jamie (The Distracted)',
            content: 'A 24-year-old student using the app while commuting on a crowded train. They are frequently distracted, using the phone one-handed, and likely to miss small buttons or subtle labels.',
            fields: {
                tech_literacy: 'Medium-High',
                patience: 'Medium',
                focus: 'Low (highly distracted)',
                tone: 'Casual and fragmented'
            }
        },
        scoreData: {
            totalScore: 85,
            signalLabel: 'Good',
            signalColor: 'text-node-idea',
            signalBgColor: 'bg-node-idea',
            topAction: 'Strong context, ideal for stress testing mobile responsiveness.'
        }
    }
];

export const PRESET_SESSIONS = [
    {
        id: 'preset-session-1',
        date: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
        personaLabel: 'Elena (The Fast-Mover)',
        personaContent: 'A 32-year-old marketing executive who is extremely busy and tech-savvy. She values efficiency above all else and has zero patience for slow loading or confusing navigation.',
        targetUrl: 'https://linear.app/',
        videoUrl: null,
        mode: 'playwright' as const,
        analysis: {
            story: "Elena navigated the task management dashboard to create a new project. She was impressed by the keyboard shortcuts but felt the 'Archive' action was too subtle to find quickly.",
            insights: [
                "The 'Command+K' menu is the persona's favorite feature, matching her high tech literacy.",
                "Icon-only buttons without tooltips caused a 3-second 'dwell time' spike on the sidebar.",
                "The dark mode contrast ratio is excellent for her high-speed scanning behavior."
            ],
            metrics: {
                successScore: 85,
                frictionRating: 3,
                sentiment: "Efficient",
                cognitiveLoad: "Low",
                stepsCompleted: 8,
                abandonmentReason: null
            }
        },
        agentThoughts: [
            { step: 0, thought: "Page loaded. I need to find the project creation button.", action: "navigate", selector: null, value: null, reason: null, timestamp: Date.now() - 5000 },
            { step: 1, thought: "Looking at the sidebar. Many icons. I'll try the plus icon.", action: "hover", selector: ".sidebar-plus", value: null, reason: null, timestamp: Date.now() - 4000 },
            { step: 2, thought: "Tooltip says 'New Project'. Perfect. Clicking now.", action: "click", selector: ".sidebar-plus", value: null, reason: null, timestamp: Date.now() - 3500 },
            { step: 3, thought: "Modal opened. Typing project name 'Q2 Marketing'.", action: "type", value: "Q2 Marketing", selector: "#project-name", reason: null, timestamp: Date.now() - 2500 },
            { step: 4, thought: "Done. I'm hitting Enter to save. I hate clicking 'Save' buttons.", action: "press", value: "Enter", selector: null, reason: null, timestamp: Date.now() - 1500 }
        ],
        narrations: []
    }
];
