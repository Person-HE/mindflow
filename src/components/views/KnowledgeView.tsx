import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '../../types';

const NODE_R = 16;
const MOD_PAD = 40;
const MOD_HEADER = 36;
const NODE_GAP = 60;

const MODULE_COLORS = [
  '#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const TYPE_COLORS: Record<string, string> = {
  entity: '#6366f1',
  concept: '#a855f7',
  module: '#06b6d4',
  atomic: '#10b981',
};

const TYPE_LABELS: Record<string, string> = {
  entity: '实体',
  concept: '概念',
  module: '模块',
  atomic: '原子',
};

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

interface ModLayout {
  id: string;
  label: string;
  nodeIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export default function KnowledgeView() {
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

  const modules = useMemo(() => currentProject?.modules ?? [], [currentProject]);
  const nodes = useMemo(() => currentProject?.nodes ?? [], [currentProject]);
  const edges = useMemo(() => currentProject?.edges ?? [], [currentProject]);

  const { modLayouts, nodePositions } = useMemo<{ modLayouts: ModLayout[]; nodePositions: Map<string, { x: number; y: number }> }>(() => {
    const nPos = new Map<string, { x: number; y: number }>();
    const layouts: ModLayout[] = [];
    if (nodes.length === 0) return { modLayouts: layouts, nodePositions: nPos };

    const hasValidModules = modules.length > 0 && modules.some(m => m.nodeIds.some(id => nodes.find(n => n.id === id)));
    let effectiveModules: { id: string; label: string; nodeIds: string[]; color: string }[];

    if (hasValidModules) {
      effectiveModules = modules.map(m => ({ id: m.id, label: m.label, nodeIds: m.nodeIds.filter(id => nodes.find(n => n.id === id)), color: m.color || MODULE_COLORS[0] }));
      const groupedIds = new Set(effectiveModules.flatMap(m => m.nodeIds));
      const ungrouped = nodes.filter(n => !groupedIds.has(n.id));
      if (ungrouped.length > 0) {
        const byType: Record<string, Node[]> = {};
        ungrouped.forEach(n => { const t = n.type; if (!byType[t]) byType[t] = []; byType[t].push(n); });
        Object.entries(byType).forEach(([type, typeNodes], idx) => {
          effectiveModules.push({ id: `auto-${type}`, label: `${TYPE_LABELS[type] || type}模块`, nodeIds: typeNodes.map(n => n.id), color: TYPE_COLORS[type] || MODULE_COLORS[idx % MODULE_COLORS.length] });
        });
      }
    } else {
      const byType: Record<string, Node[]> = {};
      nodes.forEach(n => { const t = n.type; if (!byType[t]) byType[t] = []; byType[t].push(n); });
      effectiveModules = Object.entries(byType).map(([type, typeNodes], idx) => ({ id: `auto-${type}`, label: `${TYPE_LABELS[type] || type}模块`, nodeIds: typeNodes.map(n => n.id), color: TYPE_COLORS[type] || MODULE_COLORS[idx % MODULE_COLORS.length] }));
    }

    let curX = 40;
    let curY = 40;
    let rowMaxH = 0;

    effectiveModules.forEach((mod, mi) => {
      const modNodes = nodes.filter(n => mod.nodeIds.includes(n.id));
      const cols = Math.max(1, Math.ceil(Math.sqrt(modNodes.length)));
      const rows = Math.max(1, Math.ceil(modNodes.length / cols));
      const w = Math.max(200, cols * NODE_GAP + MOD_PAD * 2);
      const h = MOD_HEADER + rows * NODE_GAP + MOD_PAD;
      const color = mod.color || MODULE_COLORS[mi % MODULE_COLORS.length];

      layouts.push({ id: mod.id, label: mod.label, nodeIds: mod.nodeIds, x: curX, y: curY, w, h, color });

      modNodes.forEach((node, ni) => {
        const col = ni % cols;
        const row = Math.floor(ni / cols);
        const nx = curX + MOD_PAD + col * NODE_GAP + NODE_GAP / 2;
        const ny = curY + MOD_HEADER + row * NODE_GAP + NODE_GAP / 2;
        nPos.set(node.id, { x: nx, y: ny });
      });

      curX += w + 40;
      rowMaxH = Math.max(rowMaxH, h);
      if (curX > 1000) { curX = 40; curY += rowMaxH + 40; rowMaxH = 0; }
    });

    return { modLayouts: layouts, nodePositions: nPos };
  }, [modules, nodes]);

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
    const x = (parent?.position?.x ?? 100) + 200;
    const y = (parent?.position?.y ?? 100) + 100;
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

  const nodeToModule = useMemo(() => {
    const map = new Map<string, string>();
    modLayouts.forEach(m => m.nodeIds.forEach(id => map.set(id, m.id)));
    return map;
  }, [modLayouts]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.04) 0%, transparent 40%), #0a0a1a', position: 'relative' }} onContextMenu={handleContextMenu}>
      <svg width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <pattern id="know-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#know-grid)" />

        {modLayouts.map((layout) => (
          <g key={layout.id}>
            <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} rx={12} fill="rgba(15,15,35,0.4)" stroke={hexToRgba(layout.color, 0.35)} strokeWidth={2} strokeDasharray="8,4" />
            <rect x={layout.x} y={layout.y} width={layout.w} height={MOD_HEADER} rx={12} fill={hexToRgba(layout.color, 0.08)} />
            <rect x={layout.x} y={layout.y + MOD_HEADER - 2} width={layout.w} height={2} fill={hexToRgba(layout.color, 0.15)} />
            <text x={layout.x + 16} y={layout.y + MOD_HEADER / 2} dominantBaseline="central" fill={layout.color} fontSize={13} fontWeight={600}>
              {layout.label}
            </text>
            <text x={layout.x + layout.w - 12} y={layout.y + MOD_HEADER / 2} dominantBaseline="central" textAnchor="end" fill="#64748b" fontSize={11}>
              {layout.nodeIds.length}
            </text>
          </g>
        ))}

        {edges.map((edge) => {
          const sp = nodePositions.get(edge.source);
          const tp = nodePositions.get(edge.target);
          if (!sp || !tp) return null;
          const isCrossModule = nodeToModule.get(edge.source) !== nodeToModule.get(edge.target);
          return (
            <g key={edge.id}>
              <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y} stroke={isCrossModule ? 'rgba(168,85,247,0.3)' : 'rgba(99,102,241,0.25)'} strokeWidth={isCrossModule ? 1.5 : 1} strokeDasharray={isCrossModule ? '6,3' : '3,3'} />
              {edge.label && (
                <g transform={`translate(${(sp.x + tp.x) / 2},${(sp.y + tp.y) / 2})`}>
                  <rect x={-edge.label.length * 4 - 4} y={-8} width={edge.label.length * 8 + 8} height={16} rx={4} fill="rgba(15,23,42,0.8)" stroke="rgba(99,102,241,0.1)" strokeWidth={0.5} />
                  <text textAnchor="middle" dominantBaseline="central" fill="rgba(148,163,184,0.7)" fontSize={8}>{edge.label}</text>
                </g>
              )}
            </g>
          );
        })}

        {nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          const isSelected = selectedNodeId === node.id;
          const color = TYPE_COLORS[node.type] || '#6366f1';
          return (
            <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
              {isSelected && <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />}
              <circle cx={pos.x} cy={pos.y} r={NODE_R} fill="#0f172a" stroke={color} strokeWidth={isSelected ? 2 : 1} />
              <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={hexToRgba(color, 0.1)} />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={9} fontWeight={600} style={{ pointerEvents: 'none' }}>
                {node.label.length > 5 ? node.label.substring(0, 5) + '…' : node.label}
              </text>
              <text x={pos.x} y={pos.y + NODE_R + 12} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={8} style={{ pointerEvents: 'none' }}>
                {TYPE_LABELS[node.type] || node.type}
              </text>
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

      <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 12, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '8px 14px', border: '1px solid rgba(99,102,241,0.15)' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{TYPE_LABELS[type] || type}</span>
          </div>
        ))}
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
