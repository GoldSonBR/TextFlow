
export enum NodeType {
  INPUT = 'INPUT',
  AI_GENERATOR = 'AI_GENERATOR',
  AI_OPTIMIZER = 'AI_OPTIMIZER',
  AI_FACT_CHECK = 'AI_FACT_CHECK',
  AI_CODER = 'AI_CODER',
  OUTPUT_PREVIEW = 'OUTPUT_PREVIEW',
  IMAGE_NODE = 'IMAGE_NODE',
  AI_BRAINSTORM = 'AI_BRAINSTORM',
}

export enum NodeStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface NodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  title: string;
  content: string; // The output text of this node
  
  // Customization fields
  userPrompt?: string; // For input nodes
  systemInstruction?: string; // Hidden instruction for AI nodes
  model?: string;
  
  // specific fields
  customTemplate?: string; // For AI_CODER to use raw HTML
  imageUrls?: string[]; // For IMAGE_NODE (Changed to array)
  
  status: NodeStatus;
  errorMessage?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Workspace {
  id: string;
  name: string;
  globalContext: string; // The "Company Description" that influences all AI
  nodes: NodeData[];
  connections: Connection[];
  pan: { x: number; y: number };
  scale: number;
}