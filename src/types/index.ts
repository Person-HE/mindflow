export interface Node {
  id: string;
  type: 'entity' | 'concept' | 'module' | 'atomic';
  label: string;
  description?: string;
  properties: Record<string, any>;
  position: { x: number; y: number };
  parentId?: string;
  children: string[];
  connections: string[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    tags: string[];
    importance: number;
  };
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  metadata: {
    createdAt: number;
    strength: number;
  };
}

export interface Module {
  id: string;
  label: string;
  description?: string;
  nodeIds: string[];
  color: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ViewState {
  id: string;
  type: 'tree' | 'network' | 'kanban' | 'knowledge' | 'architecture' | 'breakdown';
  name: string;
  config: Record<string, any>;
  isRecommended: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  modules: Module[];
  viewStates: ViewState[];
  activeView: string;
  createdAt: number;
  updatedAt: number;
  settings: {
    aiModel: string;
    autoSave: boolean;
    storageType: 'local' | 'cloud';
  };
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type: 'text' | 'command' | 'suggestion';
}

export interface AIParsedResult {
  nodes: Node[];
  edges: Edge[];
  modules: Module[];
  recommendedView: string;
  confidence: number;
  warnings: string[];
}

export type ViewType = 'tree' | 'network' | 'kanban' | 'knowledge' | 'architecture' | 'breakdown';

export interface EditCommand {
  type: 'add_node' | 'delete_node' | 'update_node' | 'add_edge' | 'delete_edge' | 'update_edge' | 'add_module' | 'delete_module';
  data: any;
  timestamp: number;
}

export interface AIConfig {
  provider: 'openai' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ExportOptions {
  format: 'json' | 'markdown' | 'pdf' | 'png';
  includeMetadata: boolean;
  quality: 'low' | 'medium' | 'high';
}
