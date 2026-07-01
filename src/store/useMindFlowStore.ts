import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge, Module, ViewState, Project, AIMessage, AIParsedResult, ViewType, EditCommand, AIConfig, ExportOptions } from '../types';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  modules: Module[];
}

interface MindFlowState {
  currentProject: Project | null;
  projects: Project[];
  chatMessages: AIMessage[];
  isProcessing: boolean;
  activeView: ViewType;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  aiConfig: AIConfig;
  showSettings: boolean;
  showNodeDetail: boolean;
  showExportDialog: boolean;
  toastMessage: string | null;
  viewZoom: number;
  viewPan: { x: number; y: number };

  setCurrentProject: (project: Project) => void;
  createNewProject: (name: string) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  deleteEdge: (id: string) => void;
  addModule: (module: Module) => void;
  updateModule: (id: string, updates: Partial<Module>) => void;
  deleteModule: (id: string) => void;
  setActiveView: (view: ViewType) => void;
  addChatMessage: (message: AIMessage) => void;
  setIsProcessing: (processing: boolean) => void;
  processAIResponse: (result: AIParsedResult) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => void;
  loadProject: (id: string) => void;
  setAIConfig: (config: Partial<AIConfig>) => void;
  setShowSettings: (show: boolean) => void;
  setShowNodeDetail: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  setViewZoom: (zoom: number) => void;
  setViewPan: (pan: { x: number; y: number }) => void;
  exportProject: (options: ExportOptions) => void;
  takeSnapshot: () => void;
}

const defaultAIConfig: AIConfig = {
  provider: 'ollama',
  apiKey: '',
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 4096,
};

const loadAIConfig = (): AIConfig => {
  try {
    const saved = localStorage.getItem('mindflow-ai-config');
    if (saved) return { ...defaultAIConfig, ...JSON.parse(saved) };
  } catch {}
  return defaultAIConfig;
};

export const useMindFlowStore = create<MindFlowState>((set, get) => ({
  currentProject: null,
  projects: [],
  chatMessages: [],
  isProcessing: false,
  activeView: 'tree',
  selectedNodeId: null,
  selectedEdgeId: null,
  undoStack: [],
  redoStack: [],
  aiConfig: loadAIConfig(),
  showSettings: false,
  showNodeDetail: false,
  showExportDialog: false,
  toastMessage: null,
  viewZoom: 1,
  viewPan: { x: 0, y: 0 },

  setCurrentProject: (project) => set({ currentProject: project }),

  createNewProject: (name) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      nodes: [],
      edges: [],
      modules: [],
      viewStates: [
        { id: 'tree', type: 'tree', name: '层级树状图', config: {}, isRecommended: false },
        { id: 'network', type: 'network', name: '网络关系图', config: {}, isRecommended: false },
        { id: 'kanban', type: 'kanban', name: '结构化看板', config: {}, isRecommended: false },
        { id: 'knowledge', type: 'knowledge', name: '增强知识图谱', config: {}, isRecommended: false },
        { id: 'architecture', type: 'architecture', name: '架构图', config: {}, isRecommended: false },
        { id: 'breakdown', type: 'breakdown', name: '极致拆解视图', config: {}, isRecommended: false },
      ],
      activeView: 'tree',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        aiModel: 'default',
        autoSave: true,
        storageType: 'local',
      },
    };
    set({ currentProject: newProject, projects: [...get().projects, newProject] });
  },

  takeSnapshot: () => {
    const { currentProject, undoStack } = get();
    if (!currentProject) return;
    const snapshot: Snapshot = {
      nodes: JSON.parse(JSON.stringify(currentProject.nodes)),
      edges: JSON.parse(JSON.stringify(currentProject.edges)),
      modules: JSON.parse(JSON.stringify(currentProject.modules)),
    };
    set({ undoStack: [...undoStack.slice(-49), snapshot], redoStack: [] });
  },

  addNode: (node) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    const updatedProject = {
      ...currentProject,
      nodes: [...currentProject.nodes, node],
      updatedAt: Date.now(),
    };
    set({ currentProject: updatedProject });
  },

  updateNode: (id, updates) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    const updatedNodes = currentProject.nodes.map(node =>
      node.id === id ? { ...node, ...updates, metadata: { ...node.metadata, updatedAt: Date.now() } } : node
    );
    set({ currentProject: { ...currentProject, nodes: updatedNodes, updatedAt: Date.now() } });
  },

  deleteNode: (id) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    const updatedNodes = currentProject.nodes.filter(node => node.id !== id);
    const updatedEdges = currentProject.edges.filter(edge => edge.source !== id && edge.target !== id);
    const updatedModules = currentProject.modules.map(m => ({
      ...m,
      nodeIds: m.nodeIds.filter(nid => nid !== id),
    }));
    set({
      currentProject: {
        ...currentProject,
        nodes: updatedNodes,
        edges: updatedEdges,
        modules: updatedModules,
        updatedAt: Date.now(),
      },
      selectedNodeId: null,
    });
  },

  addEdge: (edge) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    set({ currentProject: { ...currentProject, edges: [...currentProject.edges, edge], updatedAt: Date.now() } });
  },

  updateEdge: (id, updates) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    const updatedEdges = currentProject.edges.map(edge =>
      edge.id === id ? { ...edge, ...updates } : edge
    );
    set({ currentProject: { ...currentProject, edges: updatedEdges, updatedAt: Date.now() } });
  },

  deleteEdge: (id) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();
    set({
      currentProject: {
        ...currentProject,
        edges: currentProject.edges.filter(edge => edge.id !== id),
        updatedAt: Date.now(),
      },
      selectedEdgeId: null,
    });
  },

  addModule: (module) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({ currentProject: { ...currentProject, modules: [...currentProject.modules, module], updatedAt: Date.now() } });
  },

  updateModule: (id, updates) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const updatedModules = currentProject.modules.map(module =>
      module.id === id ? { ...module, ...updates } : module
    );
    set({ currentProject: { ...currentProject, modules: updatedModules, updatedAt: Date.now() } });
  },

  deleteModule: (id) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({
      currentProject: {
        ...currentProject,
        modules: currentProject.modules.filter(module => module.id !== id),
        updatedAt: Date.now(),
      },
    });
  },

  setActiveView: (view) => {
    const { currentProject } = get();
    if (currentProject) {
      set({ activeView: view, currentProject: { ...currentProject, activeView: view, updatedAt: Date.now() } });
    } else {
      set({ activeView: view });
    }
  },

  addChatMessage: (message) => {
    set({ chatMessages: [...get().chatMessages, message] });
  },

  setIsProcessing: (processing) => set({ isProcessing: processing }),

  processAIResponse: (result) => {
    const { currentProject, takeSnapshot } = get();
    if (!currentProject) return;
    takeSnapshot();

    let newNodes = [...currentProject.nodes];
    let newEdges = [...currentProject.edges];
    const newModules = [...currentProject.modules];

    const deleteKeys: string[] = [];
    const addNodes: Node[] = [];

    result.nodes.forEach(node => {
      if (node.label.startsWith('delete:')) {
        const deleteKey = node.label.replace('delete:', '').trim();
        deleteKeys.push(deleteKey);
      } else {
        addNodes.push(node);
      }
    });

    // 删除：同时支持通过 id 或 label 删除
    if (deleteKeys.length > 0) {
      const normalizedDeleteKeys = deleteKeys.map(k => k.toLowerCase());
      newNodes = newNodes.filter(n =>
        !deleteKeys.includes(n.id) &&
        !normalizedDeleteKeys.includes(n.label.toLowerCase())
      );
      // 同时清理被删除节点的边
      const remainingIds = new Set(newNodes.map(n => n.id));
      newEdges = newEdges.filter(e => remainingIds.has(e.source) && remainingIds.has(e.target));
    }

    addNodes.forEach(node => {
      const existingIndex = newNodes.findIndex(n => n.id === node.id);
      if (existingIndex >= 0) {
        // 更新现有节点：合并字段，保留本地位置等状态
        const existing = newNodes[existingIndex];
        const isPlaceholderPos = node.position.x === 0 && node.position.y === 0;
        const hasProps = node.properties && Object.keys(node.properties).length > 0;
        newNodes[existingIndex] = {
          ...existing,
          ...node,
          // 保留本地的位置（除非AI明确指定了非0,0位置）
          position: isPlaceholderPos ? existing.position : node.position,
          // 合并属性
          properties: hasProps ? { ...existing.properties, ...node.properties } : existing.properties,
          // 保留连接关系
          connections: existing.connections,
          children: existing.children,
          // 更新元数据
          metadata: { ...existing.metadata, ...node.metadata, updatedAt: Date.now() },
        };
      } else {
        // 检查 label 是否已存在（避免重复添加）
        const labelExists = newNodes.find(n => n.label.toLowerCase() === node.label.toLowerCase());
        if (!labelExists) {
          newNodes.push(node);
        }
      }
    });

    result.edges.forEach(edge => {
      const exists = newEdges.find(e =>
        (e.source === edge.source && e.target === edge.target) ||
        e.id === edge.id
      );
      if (!exists) {
        newEdges.push(edge);
      }
    });

    result.modules.forEach(module => {
      const exists = newModules.find(m => m.id === module.id);
      if (!exists) {
        newModules.push(module);
      }
    });

    if (result.recommendedView) {
      set({ activeView: result.recommendedView as ViewType });
    }
    set({ currentProject: { ...currentProject, nodes: newNodes, edges: newEdges, modules: newModules, updatedAt: Date.now() } });
  },

  selectNode: (id) => set({ selectedNodeId: id, showNodeDetail: id !== null }),
  selectEdge: (id) => set({ selectedEdgeId: id }),

  undo: () => {
    const { undoStack, redoStack, currentProject } = get();
    if (undoStack.length === 0 || !currentProject) return;
    const currentSnapshot: Snapshot = {
      nodes: JSON.parse(JSON.stringify(currentProject.nodes)),
      edges: JSON.parse(JSON.stringify(currentProject.edges)),
      modules: JSON.parse(JSON.stringify(currentProject.modules)),
    };
    const prevSnapshot = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, currentSnapshot],
      currentProject: {
        ...currentProject,
        nodes: prevSnapshot.nodes,
        edges: prevSnapshot.edges,
        modules: prevSnapshot.modules,
        updatedAt: Date.now(),
      },
    });
  },

  redo: () => {
    const { undoStack, redoStack, currentProject } = get();
    if (redoStack.length === 0 || !currentProject) return;
    const currentSnapshot: Snapshot = {
      nodes: JSON.parse(JSON.stringify(currentProject.nodes)),
      edges: JSON.parse(JSON.stringify(currentProject.edges)),
      modules: JSON.parse(JSON.stringify(currentProject.modules)),
    };
    const nextSnapshot = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, currentSnapshot],
      currentProject: {
        ...currentProject,
        nodes: nextSnapshot.nodes,
        edges: nextSnapshot.edges,
        modules: nextSnapshot.modules,
        updatedAt: Date.now(),
      },
    });
  },

  saveProject: () => {
    const { currentProject, showToast } = get();
    if (!currentProject) return;
    localStorage.setItem(`mindflow-project-${currentProject.id}`, JSON.stringify(currentProject));
    const projects = JSON.parse(localStorage.getItem('mindflow-projects') || '[]');
    const existingIndex = projects.findIndex((p: Project) => p.id === currentProject.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = { id: currentProject.id, name: currentProject.name, updatedAt: currentProject.updatedAt };
    } else {
      projects.push({ id: currentProject.id, name: currentProject.name, updatedAt: currentProject.updatedAt });
    }
    localStorage.setItem('mindflow-projects', JSON.stringify(projects));
    showToast('项目已保存');
  },

  loadProject: (id) => {
    const projectData = localStorage.getItem(`mindflow-project-${id}`);
    if (projectData) {
      const project = JSON.parse(projectData);
      set({ currentProject: project, activeView: (project.activeView || 'tree') as ViewType, chatMessages: [] });
    }
  },

  setAIConfig: (config) => {
    const newConfig = { ...get().aiConfig, ...config };
    localStorage.setItem('mindflow-ai-config', JSON.stringify(newConfig));
    set({ aiConfig: newConfig });
  },

  setShowSettings: (show) => set({ showSettings: show }),
  setShowNodeDetail: (show) => set({ showNodeDetail: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),

  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 2000);
  },

  clearToast: () => set({ toastMessage: null }),

  setViewZoom: (zoom) => set({ viewZoom: Math.max(0.1, Math.min(3, zoom)) }),
  setViewPan: (pan) => set({ viewPan: pan }),

  exportProject: (options) => {
    const { currentProject, showToast } = get();
    if (!currentProject) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (options.format) {
      case 'json':
        content = JSON.stringify(currentProject, null, 2);
        filename = `${currentProject.name}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = generateMarkdown(currentProject);
        filename = `${currentProject.name}.md`;
        mimeType = 'text/markdown';
        break;
      default:
        content = JSON.stringify(currentProject, null, 2);
        filename = `${currentProject.name}.json`;
        mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已导出为 ${options.format.toUpperCase()}`);
  },
}));

function generateMarkdown(project: Project): string {
  let md = `# ${project.name}\n\n`;
  if (project.description) md += `${project.description}\n\n`;

  md += `## 节点列表\n\n`;
  project.nodes.forEach(node => {
    md += `### ${node.label}\n`;
    md += `- 类型: ${node.type}\n`;
    if (node.description) md += `- 描述: ${node.description}\n`;
    md += `- 连接数: ${node.connections.length}\n\n`;
  });

  md += `## 关系列表\n\n`;
  project.edges.forEach(edge => {
    const source = project.nodes.find(n => n.id === edge.source);
    const target = project.nodes.find(n => n.id === edge.target);
    md += `- ${source?.label || edge.source} → ${edge.label} → ${target?.label || edge.target}\n`;
  });

  if (project.modules.length > 0) {
    md += `\n## 模块分组\n\n`;
    project.modules.forEach(module => {
      md += `### ${module.label}\n`;
      module.nodeIds.forEach(nodeId => {
        const node = project.nodes.find(n => n.id === nodeId);
        if (node) md += `- ${node.label}\n`;
      });
      md += '\n';
    });
  }

  return md;
}
