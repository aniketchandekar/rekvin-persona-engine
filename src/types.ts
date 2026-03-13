export type NodeType =
  | 'idea'
  | 'persona'
  | 'input'
  | 'research'
  | 'scene'
  | 'journey'
  | 'tension'
  | 'assume'
  | 'question';

export interface NodeData {
  label: string;
  type: NodeType;
  content: string;
  [key: string]: any;
}

export interface Narration {
  id: string;
  text: string;
}

// ── Playwright Agent Types ──────────────────────────────────────────

export interface AgentThought {
  step: number;
  thought: string;
  action: string;
  selector: string | null;
  value: string | null;
  reason: string | null;
  timestamp?: number;
}

export interface AgentScreenshot {
  step: number;
  url: string;
  image: string; // base64
}

export interface AgentAnalysis {
  story: string;
  insights: string[];
  metrics: {
    successScore: number;
    frictionRating: number;
    sentiment: string;
    cognitiveLoad: string;
    stepsCompleted: number;
    abandonmentReason: string | null;
  };
}

// ── Session Types ───────────────────────────────────────────────────

export interface SavedSession {
  id: string;
  date: number;
  personaLabel: string;
  personaContent?: string;
  targetUrl: string;
  videoUrl: string | null;
  narrations: Narration[];
  analysis?: {
    story: string;
    insights?: string[];
    metrics: {
      successScore: number;
      frictionRating: number;
      sentiment: string;
      cognitiveLoad: string;
      stepsCompleted?: number;
      abandonmentReason?: string | null;
    }
  };
  mode?: 'vision' | 'playwright';
  voiceName?: string;
  agentThoughts?: AgentThought[];
  agentScreenshots?: AgentScreenshot[];
}
