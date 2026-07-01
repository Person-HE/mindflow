import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '../../types';

const LAYER_H = 100;
const LAYER_GAP = 60;
const NODE_W = 120;
const NODE_H = 44;
const NODE_GAP = 20;
const LAYER_LABEL_W = 80;
const PAD = 40;

const TYPE_COLORS: Record<string, string> = {
  entity: '#6366f1',
  concept: '#a855f7',
  module: '#06b6d4',
  atomic: '#10b981',
};

const TYPE_LABELS: Record<string, string> = {
  entity: '实体层',
  concept: '概念层',
  module: '模块层',
  atomic: '原子层',
};

const LAYER_ORDER = ['module', 'concept', 'entity', 'atomic'];

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function ArchitectureView() {
  const { currentProject, selectNode, selectedNodeId, viewZoom, setViewZoom, viewPan, setViewPan, addNode, updateNode, deleteNode, addEdge } = useMindFlowStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; nodeId: string | null }>({ visible: false, x: 0, y: 0, nodeId: null });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const nodes = useMemo(() => currentProject?.nodes ?? [], [currentProject]);
  const edges = useMemo(() => currentProject?.edges ?? [], [currentProject]);

  const layers = useMemo(() => {
    if (nodes.length === 0) return [] as { type: string; name: string; nodes: Node[] }[];
    const types = new Set(nodes.map(n => n.type));
    if (types.size === 1) {
      const sorted = [...nodes].sort((a, b) => (b.metadata?.importance ?? 5) - (a.metadata?.importance ?? 5));
      const third = Math.max(1, Math.ceil(sorted.length / 3));
      const result: { type: string; name: string; nodes: Node[] }[] = [];
      const high = sorted.slice(0, third);
      const mid = sorted.slice(third, third * 2);
      const low = sorted.slice(third * 2);
      if (high.length > 0) result.push({ type: 'high', name: '高优先级', nodes: high });
      if (mid.length > 0) result.push({ type: 'mid', name: '中优先级', nodes: mid });
      if (low.length > 0) result.push({ type: 'low', name: '低优先级', nodes: low });
      return result;
    }
    const byType = new Map<string, Node[]>();
    nodes.forEach(node => {
      const t = node.type || 'entity';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(node);
    });
    const result: { type: string; name: string; nodes: Node[] }[] = [];
    const seen = new Set<string>();
    LAYER_ORDER.forEach(type => {
      if (byType.has(type)) { result.push({ type, name: TYPE_LABELS[type] || type, nodes: byType.get(type)! }); seen.add(type); }
    });
    byType.forEach((layerNodes, type) => {
      if (!seen.has(type)) result.push({ type, name: TYPE_LABELS[type] || type, nodes: layerNodes });
    });
    return result;
  }, [nodes]);

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; layerIdx: number }>();
    layers.forEach((layer, li) => {
      const layerY = PAD + li * (LAYER_H + LAYER_GAP);
      const startX = LAYER_LABEL_W + PAD + 20;
      layer.nodes.forEach((node, ni) => {
        pos.set(node.id, { x: startX + ni * (NODE_W + NODE_GAP), y: layerY + (LAYER_H - NODE_H) / 2, layerIdx: li });
      });
    });
    return pos;
  }, [layers]);

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: -viewPan.x + ((clientX - rect.left) / rect.width) * (svgSize.w / viewZoom),
      y: -viewPan.y + ((clientY - rect.top) / rect.height) * (svgSize.h / viewZoom),
    };
  }, [viewPan, viewZoom, svgSize]);

  const viewBox = `${-viewPan.x} ${-viewPan.y} ${svgSize.w / viewZoom} ${svgSize.h / viewZoom}`;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setViewZoom(viewZoom + (e.deltaY > 0 ? -0.1 : 0.1));
  }, [viewZoom, setViewZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest('.view-node')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panStartOffset.current = { ...viewPan };
  }, [viewPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = (e.clientX - panStart.current.x) / viewZoom;
    const dy = (e.clientY - panStart.current.y) / viewZoom;
    setViewPan({ x: panStartOffset.current.x - dx, y: panStartOffset.current.y - dy });
  }, [viewZoom, setViewPan]);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const nodeEl = (e.target as Element).closest('.view-node');
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        const label = window.prompt('请输入新的节点名称', node?.label || '');
        if (label) updateNode(nodeId, { label });
      }
    } else {
      const pt = getSvgPoint(e.clientX, e.clientY);
      const label = window.prompt('请输入节点名称', '新节点');
      if (!label) return;
      const newNode: Node = { id: uuidv4(), type: 'entity', label, properties: {}, position: { x: pt.x, y: pt.y }, children: [], connections: [], metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 } };
      addNode(newNode);
    }
  }, [getSvgPoint, nodes, updateNode, addNode]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeEl = (e.target as Element).closest('.view-node');
    const nodeId = nodeEl?.getAttribute('data-node-id') || null;
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId });
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = () => setContextMenu(c => ({ ...c, visible: false }));
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu.visible]);

  const handleAddNodeAt = (clientX: number, clientY: number) => {
    const pt = getSvgPoint(clientX, clientY);
    const label = window.prompt('请输入节点名称', '新节点');
    if (!label) return;
    const newNode: Node = { id: uuidv4(), type: 'entity', label, properties: {}, position: { x: pt.x, y: pt.y }, children: [], connections: [], metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 } };
    addNode(newNode);
  };

  const handleAddChild = (parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    const x = (parent?.position?.x ?? PAD) + 200;
    const y = (parent?.position?.y ?? PAD) + 100;
    const label = window.prompt('请输入子节点名称', '新节点');
    if (!label) return;
    const newNode: Node = { id: uuidv4(), type: 'entity', label, properties: {}, position: { x, y }, parentId, children: [], connections: [], metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 } };
    addNode(newNode);
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    if (connectFrom && connectFrom !== nodeId) {
      const newEdge = { id: uuidv4(), source: connectFrom, target: nodeId, type: 'relation', label: '关联', properties: {}, metadata: { createdAt: Date.now(), strength: 1 } };
      addEdge(newEdge);
      setConnectFrom(null);
    } else {
      selectNode(nodeId);
    }
  }, [connectFrom, addEdge, selectNode]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(99,102,241,0.02) 0%, transparent 50%), #0a0a1a', position: 'relative' }} onContextMenu={handleContextMenu}>
      <svg width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <pattern id="arch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
          <marker id="arch-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto" fill="rgba(99,102,241,0.4)">
            <polygon points="0 0, 8 3, 0 6" />
          </marker>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#arch-grid)" />

        {layers.map((layer, li) => {
          const layerY = PAD + li * (LAYER_H + LAYER_GAP);
          const color = TYPE_COLORS[layer.type] || '#6366f1';
          const layerW = Math.max(600, layer.nodes.length * (NODE_W + NODE_GAP) + LAYER_LABEL_W + 60);
          return (
            <g key={`${layer.type}-${li}`}>
              <rect x={PAD} y={layerY} width={layerW} height={LAYER_H} rx={10} fill={hexToRgba(color, 0.03)} stroke={hexToRgba(color, 0.12)} strokeWidth={1} />
              <rect x={PAD} y={layerY} width={LAYER_LABEL_W} height={LAYER_H} rx={10} fill={hexToRgba(color, 0.06)} />
              <text x={PAD + LAYER_LABEL_W / 2} y={layerY + LAYER_H / 2 - 8} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={12} fontWeight={700}>
                {layer.name}
              </text>
              <text x={PAD + LAYER_LABEL_W / 2} y={layerY + LAYER_H / 2 + 10} textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize={10}>
                {layer.nodes.length} 节点
              </text>

              {layer.nodes.map((node) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;
                const isSelected = selectedNodeId === node.id;
                const nodeColor = TYPE_COLORS[node.type] || '#6366f1';
                return (
                  <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
                    {isSelected && <rect x={pos.x - 3} y={pos.y - 3} width={NODE_W + 6} height={NODE_H + 6} rx={10} fill="none" stroke={nodeColor} strokeWidth={2} strokeDasharray="4,3" />}
                    <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8} fill={isSelected ? hexToRgba(nodeColor, 0.15) : '#0f172a'} stroke={isSelected ? nodeColor : hexToRgba(nodeColor, 0.3)} strokeWidth={isSelected ? 2 : 1} />
                    <circle cx={pos.x + 14} cy={pos.y + NODE_H / 2} r={4} fill={nodeColor} />
                    <text x={pos.x + 26} y={pos.y + NODE_H / 2 - 4} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
                      {node.label.length > 8 ? node.label.substring(0, 8) + '…' : node.label}
                    </text>
                    <text x={pos.x + 26} y={pos.y + NODE_H / 2 + 8} dominantBaseline="central" fill={nodeColor} fontSize={8} style={{ pointerEvents: 'none' }}>
                      {TYPE_LABELS[node.type]?.replace('层', '') || node.type}
                    </text>
                  </g>
                );
              })}

              {li < layers.length - 1 && (
                <line x1={PAD + layerW / 2} y1={layerY + LAYER_H} x2={PAD + layerW / 2} y2={layerY + LAYER_H + LAYER_GAP} stroke="rgba(99,102,241,0.15)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arch-arrow)" />
              )}
            </g>
          );
        })}

        {edges.map((edge) => {
          const sp = nodePositions.get(edge.source);
          const tp = nodePositions.get(edge.target);
          if (!sp || !tp) return null;
          const isSameLayer = sp.layerIdx === tp.layerIdx;
          const sx = sp.x + NODE_W / 2;
          const sy = sp.y + NODE_H / 2;
          const tx = tp.x + NODE_W / 2;
          const ty = tp.y + NODE_H / 2;
          if (isSameLayer) {
            return <path key={edge.id} d={`M${sx},${sp.y + NODE_H} C${sx},${sp.y + NODE_H + 30} ${tx},${tp.y - 30} ${tx},${tp.y}`} fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth={1} strokeDasharray="4,3" />;
          }
          return (
            <g key={edge.id}>
              <line x1={sx} y1={sp.y + NODE_H} x2={tx} y2={tp.y} stroke="rgba(99,102,241,0.2)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arch-arrow)" />
              {edge.label && (
                <g transform={`translate(${(sx + tx) / 2},${(sp.y + NODE_H + tp.y) / 2})`}>
                  <rect x={-edge.label.length * 4 - 4} y={-8} width={edge.label.length * 8 + 8} height={16} rx={4} fill="rgba(15,23,42,0.85)" stroke="rgba(99,102,241,0.1)" strokeWidth={0.5} />
                  <text textAnchor="middle" dominantBaseline="central" fill="rgba(148,163,184,0.7)" fontSize={8}>{edge.label}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {nodes.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#475569', fontSize: 14, pointerEvents: 'none' }}>
          双击空白处添加节点
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>

      {connectFrom && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: '8px 16px', color: '#a5b4fc', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
          连接模式：请点击目标节点
          <button style={{ background: 'rgba(99,102,241,0.2)', border: 'none', color: '#a5b4fc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }} onClick={() => setConnectFrom(null)}>取消</button>
        </div>
      )}

      {contextMenu.visible && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '4px 0', minWidth: 140, zIndex: 1000, backdropFilter: 'blur(8px)' }} onClick={e => e.stopPropagation()}>
          {contextMenu.nodeId ? (
            <>
              <div style={{ padding: '8px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: 13 }} onClick={() => { const node = nodes.find(n => n.id === contextMenu.nodeId); const label = window.prompt('请输入新的节点名称', node?.label || ''); if (label) updateNode(contextMenu.nodeId!, { label }); setContextMenu(c => ({ ...c, visible: false })); }}>编辑名称</div>
              <div style={{ padding: '8px 16px', cursor: 'pointer', color: '#fca5a5', fontSize: 13 }} onClick={() => { deleteNode(contextMenu.nodeId!); setContextMenu(c => ({ ...c, visible: false })); }}>删除节点</div>
              <div style={{ padding: '8px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: 13 }} onClick={() => { handleAddChild(contextMenu.nodeId!); setContextMenu(c => ({ ...c, visible: false })); }}>添加子节点</div>
              <div style={{ padding: '8px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: 13 }} onClick={() => { setConnectFrom(contextMenu.nodeId); setContextMenu(c => ({ ...c, visible: false })); }}>连接到...</div>
            </>
          ) : (
            <div style={{ padding: '8px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: 13 }} onClick={() => { handleAddNodeAt(contextMenu.x, contextMenu.y); setContextMenu(c => ({ ...c, visible: false })); }}>添加节点</div>
          )}
        </div>
      )}
    </div>
  );
}
