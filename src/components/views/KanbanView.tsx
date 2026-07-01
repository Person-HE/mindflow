import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '../../types';

const LANE_W = 220;
const CARD_H = 56;
const CARD_W = 190;
const CARD_GAP = 12;
const HEADER_H = 40;
const PAD = 40;
const LANE_GAP = 30;

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

export default function KanbanView() {
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

  const hasTags = nodes.some(n => n.metadata?.tags && n.metadata.tags.length > 0);

  const lanes = useMemo(() => {
    if (nodes.length === 0) return [] as { key: string; label: string; nodes: Node[]; color: string }[];
    const grouped: Record<string, Node[]> = {};
    const labelMap: Record<string, string> = {};
    const colorMap: Record<string, string> = {};
    nodes.forEach(node => {
      let category: string;
      if (hasTags && node.metadata?.tags && node.metadata.tags.length > 0) {
        category = node.metadata.tags[0];
      } else {
        category = node.type;
      }
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(node);
      labelMap[category] = TYPE_LABELS[category] || category;
      colorMap[category] = TYPE_COLORS[category] || '#6366f1';
    });
    return Object.entries(grouped).map(([key, laneNodes]) => ({ key, label: labelMap[key] || key, nodes: laneNodes, color: colorMap[key] }));
  }, [nodes, hasTags]);

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; laneIdx: number; nodeIdx: number }>();
    lanes.forEach((lane, li) => {
      lane.nodes.forEach((node, ni) => {
        pos.set(node.id, { x: PAD + li * (LANE_W + LANE_GAP), y: PAD + HEADER_H + ni * (CARD_H + CARD_GAP), laneIdx: li, nodeIdx: ni });
      });
    });
    return pos;
  }, [lanes]);

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
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a0a1a', position: 'relative' }} onContextMenu={handleContextMenu}>
      <svg width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <pattern id="kanban-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#kanban-grid)" />

        {lanes.map((lane, li) => {
          const laneX = PAD + li * (LANE_W + LANE_GAP);
          const laneH = HEADER_H + lane.nodes.length * (CARD_H + CARD_GAP) + 20;
          return (
            <g key={lane.key}>
              <rect x={laneX} y={PAD} width={LANE_W} height={laneH} rx={10} fill="rgba(15,15,35,0.5)" stroke={hexToRgba(lane.color, 0.15)} strokeWidth={1} />
              <rect x={laneX} y={PAD} width={LANE_W} height={HEADER_H} rx={10} fill={hexToRgba(lane.color, 0.08)} />
              <rect x={laneX} y={PAD + HEADER_H - 1} width={LANE_W} height={2} fill={hexToRgba(lane.color, 0.1)} />
              <text x={laneX + 16} y={PAD + HEADER_H / 2} dominantBaseline="central" fill="#e2e8f0" fontSize={13} fontWeight={600}>
                {lane.label}
              </text>
              <text x={laneX + LANE_W - 12} y={PAD + HEADER_H / 2} dominantBaseline="central" textAnchor="end" fill="#64748b" fontSize={11}>
                {lane.nodes.length}
              </text>

              {li < lanes.length - 1 && (
                <line x1={laneX + LANE_W + LANE_GAP / 2} y1={PAD + 10} x2={laneX + LANE_W + LANE_GAP / 2} y2={PAD + laneH - 10} stroke="rgba(99,102,241,0.1)" strokeWidth={1} strokeDasharray="4,4" />
              )}

              {lane.nodes.map((node, ni) => {
                const isSelected = selectedNodeId === node.id;
                const color = TYPE_COLORS[node.type] || '#6366f1';
                const cx = laneX + 15;
                const cy = PAD + HEADER_H + ni * (CARD_H + CARD_GAP) + 12;
                return (
                  <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
                    {isSelected && (
                      <rect x={cx - 2} y={cy - 2} width={CARD_W + 4} height={CARD_H + 4} rx={10} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
                    )}
                    <rect x={cx} y={cy} width={CARD_W} height={CARD_H} rx={8} fill={isSelected ? hexToRgba(color, 0.12) : '#0f172a'} stroke={isSelected ? color : 'rgba(99,102,241,0.2)'} strokeWidth={isSelected ? 1.5 : 1} />
                    <circle cx={cx + 14} cy={cy + 18} r={5} fill={color} />
                    <text x={cx + 26} y={cy + 18} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={12} fontWeight={600} style={{ pointerEvents: 'none' }}>
                      {node.label.length > 10 ? node.label.substring(0, 10) + '…' : node.label}
                    </text>
                    <rect x={cx + 8} y={cy + 34} width={TYPE_LABELS[node.type]?.length * 12 + 12} height={16} rx={8} fill={hexToRgba(color, 0.15)} stroke={hexToRgba(color, 0.3)} strokeWidth={0.5} />
                    <text x={cx + 14} y={cy + 42} dominantBaseline="central" fill={color} fontSize={9} style={{ pointerEvents: 'none' }}>
                      {TYPE_LABELS[node.type] || node.type}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {edges.map((edge) => {
          const sp = nodePositions.get(edge.source);
          const tp = nodePositions.get(edge.target);
          if (!sp || !tp) return null;
          const sx = sp.x + CARD_W / 2 + 15;
          const sy = sp.y + CARD_H / 2 + 12;
          const tx = tp.x + CARD_W / 2 + 15;
          const ty = tp.y + CARD_H / 2 + 12;
          const isSameLane = sp.laneIdx === tp.laneIdx;
          if (isSameLane) {
            return <path key={edge.id} d={`M${sx},${sy} C${sx + 30},${sy} ${tx + 30},${ty} ${tx},${ty}`} fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth={1} strokeDasharray="4,3" />;
          }
          const midX = (sx + tx) / 2;
          return <path key={edge.id} d={`M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`} fill="none" stroke="rgba(168,85,247,0.25)" strokeWidth={1} strokeDasharray="4,3" />;
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
