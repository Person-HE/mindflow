import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge, Module, AIParsedResult, ViewType, AIConfig } from '../types';

export class AIService {
  private static instance: AIService;
  private config: AIConfig;

  private constructor(config: AIConfig) {
    this.config = config;
  }

  static getInstance(config?: AIConfig): AIService {
    if (!AIService.instance || config) {
      AIService.instance = new AIService(config || {
        provider: 'ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
        temperature: 0.7,
        maxTokens: 4096,
      });
    }
    return AIService.instance;
  }

  updateConfig(config: AIConfig) {
    this.config = config;
  }

  private async callAI(prompt: string): Promise<string> {
    const { provider, apiKey, baseUrl, model, temperature, maxTokens } = this.config;

    if (provider === 'ollama') {
      return this.callOllama(prompt, baseUrl, model, temperature);
    } else {
      return this.callOpenAICompatible(prompt, apiKey, baseUrl, model, temperature, maxTokens);
    }
  }

  private async callOllama(prompt: string, baseUrl: string, model: string, temperature: number): Promise<string> {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  private async callOpenAICompatible(prompt: string, apiKey: string, baseUrl: string, model: string, temperature: number, maxTokens: number): Promise<string> {
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that analyzes text and extracts structured information. Always respond with valid JSON only, no markdown code blocks.' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${response.statusText} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.response || '';
    return content;
  }

  async parseText(text: string): Promise<AIParsedResult> {
    const prompt = `分析以下文本，提取其中的实体、概念和它们之间的关系。

要求：
1. 只提取文本中明确写出的关系、实体和属性，不要进行深层推断
2. 以JSON格式返回结果
3. JSON格式如下：
{
  "nodes": [{"label": "名称", "type": "entity|concept|module|atomic", "description": "描述"}],
  "edges": [{"source": "源节点label", "target": "目标节点label", "label": "关系描述"}],
  "modules": [{"label": "模块名", "nodeLabels": ["节点label1", "节点label2"]}],
  "recommendedView": "tree|network|kanban|knowledge|architecture|breakdown"
}

文本内容：
${text}

请直接返回JSON，不要有其他内容。`;

    try {
      const response = await this.callAI(prompt);
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return this.convertToResult(parsed);
    } catch (error) {
      console.error('AI parsing error:', error);
      return this.fallbackParse(text);
    }
  }

  async processCommand(command: string, currentNodes: Node[], currentEdges: Edge[]): Promise<AIParsedResult> {
    const nodesContext = currentNodes.map(n => `${n.label}(${n.id})`).join(', ');
    const edgesContext = currentEdges.map(e => {
      const source = currentNodes.find(n => n.id === e.source);
      const target = currentNodes.find(n => n.id === e.target);
      return `${source?.label} -> ${e.label} -> ${target?.label}`;
    }).join(', ');

    const prompt = `当前思维导图状态：
节点：${nodesContext || '无'}
关系：${edgesContext || '无'}

用户指令：${command}

请根据指令返回JSON格式的修改操作：
- 如果是添加节点/关系：返回新的nodes和edges
- 如果是删除：返回需要删除的节点id（在label字段中用"delete:节点id"格式）
- 如果是修改：返回更新后的节点信息

JSON格式：
{
  "nodes": [{"id": "可选", "label": "名称", "type": "entity|concept|module|atomic", "description": "描述"}],
  "edges": [{"source": "源节点label或id", "target": "目标节点label或id", "label": "关系描述"}],
  "modules": [],
  "recommendedView": ""
}

请直接返回JSON。`;

    try {
      const response = await this.callAI(prompt);
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return this.convertToResult(parsed, currentNodes);
    } catch (error) {
      console.error('AI command error:', error);
      return this.fallbackCommand(command, currentNodes);
    }
  }

  private extractJSON(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }

  private convertToResult(parsed: any, existingNodes?: Node[]): AIParsedResult {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const modules: Module[] = [];

    const nodeIdMap = new Map<string, string>();

    if (parsed.nodes) {
      parsed.nodes.forEach((n: any) => {
        if (n.label && n.label.startsWith('delete:')) {
          const deleteId = n.label.replace('delete:', '');
          nodes.push({
            id: `delete-${deleteId}`,
            type: 'atomic',
            label: '',
            properties: {},
            position: { x: 0, y: 0 },
            children: [],
            connections: [],
            metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 0 },
          });
          return;
        }

        const id = n.id || uuidv4();
        nodeIdMap.set(n.label, id);
        nodes.push({
          id,
          type: n.type || 'entity',
          label: n.label || 'Unnamed',
          description: n.description || '',
          properties: n.properties || {},
          position: { x: 100 + Math.random() * 600, y: 100 + Math.random() * 400 },
          children: [],
          connections: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: n.tags || [],
            importance: n.importance || 5,
          },
        });
      });
    }

    if (parsed.edges) {
      parsed.edges.forEach((e: any) => {
        let sourceId = nodeIdMap.get(e.source) || e.source;
        let targetId = nodeIdMap.get(e.target) || e.target;

        if (existingNodes) {
          const existingSource = existingNodes.find(n => n.label === e.source || n.id === e.source);
          const existingTarget = existingNodes.find(n => n.label === e.target || n.id === e.target);
          if (existingSource) sourceId = existingSource.id;
          if (existingTarget) targetId = existingTarget.id;
        }

        edges.push({
          id: uuidv4(),
          source: sourceId,
          target: targetId,
          type: e.type || 'relation',
          label: e.label || '关联',
          properties: e.properties || {},
          metadata: { createdAt: Date.now(), strength: e.strength || 1 },
        });
      });
    }

    if (parsed.modules) {
      parsed.modules.forEach((m: any) => {
        const nodeIds = (m.nodeLabels || []).map((label: string) => nodeIdMap.get(label) || label);
        modules.push({
          id: uuidv4(),
          label: m.label || 'Module',
          description: m.description || '',
          nodeIds,
          color: `rgba(${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(Math.random() * 200 + 55)}, ${Math.floor(Math.random() * 200 + 55)}, 0.2)`,
          bounds: { x: 50, y: 50, width: 400, height: 300 },
        });
      });
    }

    return {
      nodes,
      edges,
      modules,
      recommendedView: parsed.recommendedView || 'tree',
      confidence: 0.85,
      warnings: [],
    };
  }

  private fallbackParse(text: string): AIParsedResult {
    const lines = text.split('\n').filter(l => l.trim());
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const keywords = this.extractKeywords(text);
    keywords.forEach((keyword, index) => {
      nodes.push({
        id: uuidv4(),
        type: 'entity',
        label: keyword,
        properties: {},
        position: { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 100 },
        children: [],
        connections: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 },
      });
    });

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: uuidv4(),
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'sequence',
        label: '顺序',
        properties: {},
        metadata: { createdAt: Date.now(), strength: 0.5 },
      });
    }

    return {
      nodes,
      edges,
      modules: [],
      recommendedView: nodes.length > 5 ? 'network' : 'tree',
      confidence: 0.5,
      warnings: ['AI解析失败，使用本地解析'],
    };
  }

  private fallbackCommand(command: string, currentNodes: Node[]): AIParsedResult {
    if (command.includes('添加') || command.includes('新增')) {
      const nameMatch = command.match(/添加[「"']?(.+?)[」"']?节点/) || command.match(/新增[「"']?(.+?)[」"']?/);
      const name = nameMatch ? nameMatch[1] : '新节点';
      return {
        nodes: [{
          id: uuidv4(),
          type: 'entity',
          label: name,
          properties: {},
          position: { x: 300, y: 300 },
          children: [],
          connections: [],
          metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 7 },
        }],
        edges: [],
        modules: [],
        recommendedView: 'tree',
        confidence: 0.9,
        warnings: [],
      };
    }

    return {
      nodes: [],
      edges: [],
      modules: [],
      recommendedView: 'tree',
      confidence: 0.3,
      warnings: ['无法解析指令'],
    };
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall']);
    const words = text
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word.toLowerCase()));
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 15);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { provider, baseUrl, apiKey } = this.config;

      if (provider === 'ollama') {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) throw new Error('无法连接到Ollama');
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        if (models.length === 0) {
          return { success: false, message: 'Ollama没有可用的模型' };
        }
        return { success: true, message: `连接成功，可用模型: ${models.join(', ')}` };
      } else {
        const url = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { success: true, message: 'API连接成功' };
      }
    } catch (error: any) {
      return { success: false, message: `连接失败: ${error.message}` };
    }
  }
}
