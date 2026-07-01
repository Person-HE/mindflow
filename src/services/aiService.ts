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
          { role: 'system', content: '你是一个知识图谱助手，负责分析文本并生成结构化信息。只返回有效的JSON，不要markdown代码块，不要任何解释文字。' },
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
    const prompt = `你是一个知识图谱生成器。根据用户输入的主题或文本，生成一个全面、丰富的知识图谱，将其扩展为结构化的可视化展示。

你的任务是扩展和生成相关的概念、组件、子主题及其关系，而不仅仅是字面提取。

要求：
1. 至少生成 8-15 个节点，覆盖主题的不同方面
2. 至少生成 7-12 条有意义的关系（边）
3. 适当将相关节点分组为模块
4. 为节点分配类型："entity"（实体-具体事物）、"concept"（概念-抽象想法）、"module"（模块-分组）、"atomic"（原子-细节字段）
5. 根据内容结构选择最合适的视图

节点类型说明：
- "entity"：具体的对象、工具、人员、系统
- "concept"：抽象的想法、原则、方法论
- "module"：主要类别或分组
- "atomic"：具体的细节、属性、字段

视图选择规则：
- "tree"：有清晰层级结构（父子关系、分类→子分类）
- "network"：实体之间的相互关联关系
- "kanban"：具有不同状态/类别/阶段的条目
- "knowledge"：有模块边界的分组集群
- "architecture"：分层系统或流程
- "breakdown"：单一复杂事物的详细拆解

只返回有效的JSON（不要markdown代码块，不要解释文字）：
{
  "nodes": [
    {"label": "节点名称", "type": "entity", "description": "简要描述"}
  ],
  "edges": [
    {"source": "源节点名称", "target": "目标节点名称", "label": "关系类型"}
  ],
  "modules": [
    {"label": "模块名称", "nodeLabels": ["节点1", "节点2"]}
  ],
  "recommendedView": "tree"
}

重要：边的source/target必须与节点label完全匹配。生成丰富、互联的图。

用户输入：
${text}

现在生成知识图谱JSON：`;

    try {
      const response = await this.callAI(prompt);
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return this.convertToResult(parsed);
    } catch (error) {
      console.error('AI解析错误:', error);
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

    const isDelete = command.includes('删除') || command.includes('移除') || command.includes('去掉') || command.includes('delete');
    const isAdd = command.includes('添加') || command.includes('新增') || command.includes('增加') || command.includes('加入');
    const isExpand = command.includes('展开') || command.includes('扩展') || command.includes('细化') || command.includes('详细') || command.includes('深入');
    const isRename = command.includes('重命名') || command.includes('改名') || command.includes('改名为') || command.includes('修改名称');
    const isModify = command.includes('修改') || command.includes('更改') || command.includes('编辑');
    const isConnect = command.includes('连接') || command.includes('关联') || command.includes('建立关系');

    // 删除操作：本地直接处理，避免AI延迟
    if (isDelete) {
      const targetNodes = currentNodes.filter(n => command.includes(n.label));
      if (targetNodes.length > 0) {
        return {
          nodes: targetNodes.map(targetNode => ({
            id: `delete-${targetNode.id}`,
            type: 'atomic' as const,
            label: `delete:${targetNode.id}`,
            properties: {},
            position: { x: 0, y: 0 },
            children: [],
            connections: [],
            metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 0 },
          })),
          edges: [],
          modules: [],
          recommendedView: '',
          confidence: 0.9,
          warnings: [`已删除 ${targetNodes.length} 个节点`],
        };
      }
    }

    // 重命名操作：本地直接处理
    if (isRename) {
      const targetNode = currentNodes.find(n => command.includes(n.label));
      if (targetNode) {
        // 尝试从命令中提取新名称："把X重命名为Y"、"将X改名为Y"、"X重命名为Y"
        const patterns = [
          /(?:把|将)?(.+?)(?:重命名|改名|修改名称)(?:为|成)「?(.+?)」?$/,
          /(?:把|将)?(.+?)(?:重命名|改名|修改名称)(?:为|成)(.+)$/,
        ];
        let newName: string | null = null;
        for (const pattern of patterns) {
          const match = command.match(pattern);
          if (match && match[2]) {
            newName = match[2].trim();
            break;
          }
        }
        if (newName) {
          return {
            nodes: [{
              id: targetNode.id,
              type: targetNode.type,
              label: newName,
              properties: {},
              position: { x: 0, y: 0 },
              children: [],
              connections: [],
              metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 },
            }],
            edges: [],
            modules: [],
            recommendedView: '',
            confidence: 0.9,
            warnings: [`已将「${targetNode.label}」重命名为「${newName}」`],
          };
        }
      }
    }

    // 添加/扩展/修改/连接操作：交给AI生成新内容
    const taskHint = isExpand || isAdd
      ? '扩展主题，生成相关的子概念、组件和细节（目标5-10个新节点及其关系）'
      : isConnect
      ? '根据指令建立节点之间的连接关系'
      : isModify
      ? '根据指令修改现有节点的属性或生成新的相关内容'
      : '根据指令应用到当前图谱';

    const prompt = `你是一个知识图谱助手。用户希望在现有的思维导图基础上进行修改、扩展或删除操作。

【当前状态】
节点列表: ${nodesContext || '无'}
关系列表: ${edgesContext || '无'}

【用户指令】
${command}

【任务】
${taskHint}。

【操作类型识别】
- 添加/扩展：生成与现有内容相关的新节点和关系
- 修改：更新现有节点的描述、类型等属性（label可与现有节点匹配，作为更新）
- 连接：在现有节点之间或新节点与现有节点之间建立关系
- 删除：通过 label 设置为 "delete:现有节点label" 来标记删除

【节点类型说明】
- "entity"：具体的对象、工具、人员、系统
- "concept"：抽象的想法、原则、方法论
- "module"：主要类别或分组
- "atomic"：具体的细节、属性、字段

只返回有效的JSON（不要markdown代码块，不要解释文字）：
{
  "nodes": [
    {"label": "节点名称", "type": "entity", "description": "简要描述"}
  ],
  "edges": [
    {"source": "现有或新节点的label", "target": "新节点的label", "label": "关系类型"}
  ],
  "modules": [],
  "recommendedView": ""
}

【重要规则】
1. 边的 source 可以是现有节点的 label，用于将新节点连接到当前图谱
2. 如果要删除节点，将该节点的 label 设为 "delete:要删除的节点label"
3. 如果要重命名节点，使用现有节点 label 作为新节点的 label 字段，并更新其他属性
4. 生成丰富、互联的内容，不要只生成孤立节点
5. 只返回JSON

现在生成JSON：`;

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
    let cleaned = text.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response: ' + text.substring(0, 200));
  }

  private convertToResult(parsed: any, existingNodes?: Node[]): AIParsedResult {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const modules: Module[] = [];

    const nodeIdMap = new Map<string, string>();
    const normalizedLabelMap = new Map<string, string>();

    if (parsed.nodes && Array.isArray(parsed.nodes)) {
      parsed.nodes.forEach((n: any) => {
        if (!n || !n.label) return;
        if (n.label.startsWith('delete:')) {
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
        const normalized = String(n.label).trim().toLowerCase();
        nodeIdMap.set(String(n.label), id);
        nodeIdMap.set(normalized, id);
        normalizedLabelMap.set(normalized, String(n.label));

        nodes.push({
          id,
          type: n.type || 'entity',
          label: String(n.label),
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

    const resolveNodeId = (label: string): string | null => {
      if (!label) return null;
      const direct = nodeIdMap.get(String(label));
      if (direct) return direct;
      const normalized = nodeIdMap.get(String(label).trim().toLowerCase());
      if (normalized) return normalized;
      if (existingNodes) {
        const existing = existingNodes.find(n =>
          n.label === label || n.id === label ||
          n.label.toLowerCase() === String(label).trim().toLowerCase()
        );
        if (existing) return existing.id;
      }
      return null;
    };

    if (parsed.edges && Array.isArray(parsed.edges)) {
      parsed.edges.forEach((e: any) => {
        if (!e || (!e.source && !e.from) || (!e.target && !e.to)) return;
        const sourceLabel = e.source || e.from;
        const targetLabel = e.target || e.to;
        const sourceId = resolveNodeId(sourceLabel);
        const targetId = resolveNodeId(targetLabel);

        if (sourceId && targetId && sourceId !== targetId) {
          const exists = edges.find(ed =>
            ed.source === sourceId && ed.target === targetId
          );
          if (!exists) {
            edges.push({
              id: uuidv4(),
              source: sourceId,
              target: targetId,
              type: e.type || 'relation',
              label: e.label || '关联',
              properties: e.properties || {},
              metadata: { createdAt: Date.now(), strength: e.strength || 1 },
            });
          }
        }
      });
    }

    if (parsed.modules && Array.isArray(parsed.modules)) {
      parsed.modules.forEach((m: any) => {
        if (!m || !m.label) return;
        const nodeIds = (m.nodeLabels || m.nodes || []).map((label: string) => {
          return resolveNodeId(label);
        }).filter((id: string | null): id is string => id !== null);

        if (nodeIds.length > 0) {
          modules.push({
            id: uuidv4(),
            label: String(m.label),
            description: m.description || '',
            nodeIds,
            color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 60%, 0.15)`,
            bounds: { x: 50, y: 50, width: 400, height: 300 },
          });
        }
      });
    }

    return {
      nodes,
      edges,
      modules,
      recommendedView: parsed.recommendedView || 'network',
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

    const sentences = text.split(/[。.！!？?；;\n]/).filter(s => s.trim().length > 5);
    sentences.forEach(sentence => {
      const nodesInSentence = nodes.filter(n => sentence.includes(n.label));
      for (let i = 0; i < nodesInSentence.length - 1; i++) {
        const exists = edges.find(e =>
          (e.source === nodesInSentence[i].id && e.target === nodesInSentence[i + 1].id) ||
          (e.source === nodesInSentence[i + 1].id && e.target === nodesInSentence[i].id)
        );
        if (!exists) {
          edges.push({
            id: uuidv4(),
            source: nodesInSentence[i].id,
            target: nodesInSentence[i + 1].id,
            type: 'relation',
            label: '关联',
            properties: {},
            metadata: { createdAt: Date.now(), strength: 0.5 },
          });
        }
      }
    });

    for (let i = 0; i < nodes.length - 1; i++) {
      const exists = edges.find(e =>
        (e.source === nodes[i].id && e.target === nodes[i + 1].id) ||
        (e.source === nodes[i + 1].id && e.target === nodes[i].id)
      );
      if (!exists) {
        edges.push({
          id: uuidv4(),
          source: nodes[i].id,
          target: nodes[i + 1].id,
          type: 'sequence',
          label: '顺序',
          properties: {},
          metadata: { createdAt: Date.now(), strength: 0.3 },
        });
      }
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
