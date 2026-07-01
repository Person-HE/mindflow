import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '../../types';

const NODE_RADIUS: Record<string, number> = { entity: 28, concept: 24, module: 32, atomic: 20 };
const NODE_COLOR: Record<string, string> = { entity: '#6366f1', concept: '#a855f7', module: '#06b6d4', atomic: '#10b981' };
const TYPE_LABELS: Record<string, string> = { entity: '实体', concept: '概念', module: '模块', atomic: '原子' };

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function NetworkView() {
  const { currentProject, selectNode, selectedNodeId, viewZoom, setViewZoom, viewPan, setViewPan, updateNode, addNode, deleteNode, addEdge } = useMindFlowStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const dragNodeId = useRef<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const nodeStartPos = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });
  const [localPositions, setLocalPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; nodeId: string | null }>({ visible: false, x: 0, y: 0, nodeId: null });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const nodes = useMemo(() => currentProject?.nodes ?? [], [currentProject]);
  const edges = useMemo(() => currentProject?.edges ?? [], [currentProject]);

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

  const applyForceLayout = useCallback(() => {
    if (nodes.length === 0) { setLocalPositions(new Map()); return; }
    const positions = new Map<string, { x: number; y: number }>();
    const centerX = 600;
    const centerY = 400;
    const radius = Math.max(150, 80 + nodes.length * 30);
    nodes.forEach((node, index) => {
      const pos = node.position;
      if (pos && (pos.x !== 0 || pos.y !== 0)) {
        positions.set(node.id, { ...pos });
      } else {
        const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
        positions.set(node.id, { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
      }
    });

    for (let iter = 0; iter < 100; iter++) {
      const forces = new Map<string, { fx: number; fy: number }>();
      nodes.forEach((n) => forces.set(n.id, { fx: 0, fy: 0 }));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = positions.get(nodes[i].id)!;
          const b = positions.get(nodes[j].id)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulse = 50000 / (dist * dist);
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          forces.get(nodes[i].id)!.fx += fx;
          forces.get(nodes[i].id)!.fy += fy;
          forces.get(nodes[j].id)!.fx -= fx;
          forces.get(nodes[j].id)!.fy -= fy;
        }
      }
      edges.forEach((edge) => {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        if (!a || !b) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attract = (dist - 150) * 0.01;
        forces.get(edge.source)!.fx -= (dx / dist) * attract;
        forces.get(edge.source)!.fy -= (dy / dist) * attract;
        forces.get(edge.target)!.fx += (dx / dist) * attract;
        forces.get(edge.target)!.fy += (dy / dist) * attract;
      });
      nodes.forEach((node) => {
        const pos = positions.get(node.id)!;
        const f = forces.get(node.id)!;
        const damp = 0.9 / (1 + iter * 0.005);
        pos.x += f.fx * damp;
        pos.y += f.fy * damp;
        pos.x = Math.max(80, Math.min(svgSize.w - 80, pos.x));
        pos.y = Math.max(80, Math.min(svgSize.h - 80, pos.y));
      });
    }
    setLocalPositions(positions);
  }, [nodes, edges, svgSize]);

  useEffect(() => { applyForceLayout(); }, [applyForceLayout]);

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
    hasMoved.current = false;
  }, [viewPan]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const pos = localPositions.get(nodeId);
    if (!pos) return;
    isDragging.current = true;
    dragNodeId.current = nodeId;
    dragStartPos.current = getSvgPoint(e.clientX, e.clientY);
    nodeStartPos.current = { ...pos };
    hasMoved.current = false;
  }, [localPositions, getSvgPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current && dragNodeId.current) {
      hasMoved.current = true;
      const current = getSvgPoint(e.clientX, e.clientY);
      const dx = current.x - dragStartPos.current.x;
      const dy = current.y - dragStartPos.current.y;
      setLocalPositions((prev) => { const next = new Map(prev); next.set(dragNodeId.current!, { x: nodeStartPos.current.x + dx, y: nodeStartPos.current.y + dy }); return next; });
    } else if (isPanning.current) {
      hasMoved.current = true;
      const dx = (e.clientX - panStart.current.x) / viewZoom;
      const dy = (e.clientY - panStart.current.y) / viewZoom;
      setViewPan({ x: panStartOffset.current.x - dx, y: panStartOffset.current.y - dy });
    }
  }, [getSvgPoint, viewZoom, setViewPan]);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current && dragNodeId.current) {
      const pos = localPositions.get(dragNodeId.current);
      if (pos && hasMoved.current) updateNode(dragNodeId.current, { position: { ...pos } });
      if (!hasMoved.current) {
        if (connectFrom && connectFrom !== dragNodeId.current) {
          const newEdge = { id: uuidv4(), source: connectFrom, target: dragNodeId.current, type: 'relation', label: '关联', properties: {}, metadata: { createdAt: Date.now(), strength: 1 } };
          addEdge(newEdge);
          setConnectFrom(null);
        } else {
          selectNode(dragNodeId.current);
        }
      }
    }
    isDragging.current = false;
    dragNodeId.current = null;
    isPanning.current = false;
  }, [localPositions, updateNode, selectNode, connectFrom, addEdge]);

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
    const x = (parent?.position?.x ?? 400) + 200;
    const y = (parent?.position?.y ?? 300) + 100;
    const label = window.prompt('请输入子节点名称', '新节点');
    if (!label) return;
    const newNode: Node = { id: uuidv4(), type: 'entity', label, properties: {}, position: { x, y }, parentId, children: [], connections: [], metadata: { createdAt: Date.now(), updatedAt: Date.now(), tags: [], importance: 5 } };
    addNode(newNode);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 30% 40%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.04) 0%, transparent 50%), #0a0a1a' }} onContextMenu={handleContextMenu}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <marker id="net-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" fill="rgba(99,102,241,0.5)">
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
          <marker id="net-arrow-sel" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" fill="#6366f1">
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
          <filter id="net-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feFlood floodColor="#6366f1" floodOpacity="0.5" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="net-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#net-grid)" />

        <g className="edges">
          {edges.map((edge) => {
            const sp = localPositions.get(edge.source);
            const tp = localPositions.get(edge.target);
            if (!sp || !tp) return null;
            const srcR = NODE_RADIUS[nodes.find(n => n.id === edge.source)?.type || 'entity'] || 24;
            const tgtR = NODE_RADIUS[nodes.find(n => n.id === edge.target)?.type || 'entity'] || 24;
            const angle = Math.atan2(tp.y - sp.y, tp.x - sp.x);
            const x1 = sp.x + srcR * Math.cos(angle);
            const y1 = sp.y + srcR * Math.sin(angle);
            const x2 = tp.x - tgtR * Math.cos(angle);
            const y2 = tp.y - tgtR * Math.sin(angle);
            const mx = (x1 + x2) / 2;
            const isEdgeSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
            return (
              <g key={edge.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isEdgeSelected ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'} strokeWidth={isEdgeSelected ? 2 : 1.5} markerEnd={isEdgeSelected ? 'url(#net-arrow-sel)' : 'url(#net-arrow)'} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
                {edge.label && (
                  <g transform={`translate(${mx},${(y1 + y2) / 2})`}>
                    <rect x={-edge.label.length * 4 - 6} y={-10} width={edge.label.length * 8 + 12} height={20} rx={4} fill="rgba(15,23,42,0.85)" stroke="rgba(99,102,241,0.15)" strokeWidth={0.5} />
                    <text textAnchor="middle" dominantBaseline="central" fill="rgba(148,163,184,0.9)" fontSize="10">{edge.label}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        <g className="nodes">
          {nodes.map((node) => {
            const pos = localPositions.get(node.id);
            if (!pos) return null;
            const r = NODE_RADIUS[node.type] || 24;
            const color = NODE_COLOR[node.type] || '#6366f1';
            const isSelected = selectedNodeId === node.id;
            return (
              <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'grab' }} onMouseDown={(e) => handleNodeMouseDown(e, node.id)}>
                {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 8} fill="none" stroke={hexToRgba(color, 0.25)} strokeWidth={2} strokeDasharray="4,3" />}
                <circle cx={pos.x} cy={pos.y} r={r} fill="#0f172a" stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} filter={isSelected ? 'url(#net-glow)' : undefined} />
                <circle cx={pos.x} cy={pos.y} r={r} fill={hexToRgba(color, 0.08)} />
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize="11" fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {node.label.length > 7 ? node.label.substring(0, 7) + '…' : node.label}
                </text>
                <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="9" style={{ pointerEvents: 'none' }}>
                  {TYPE_LABELS[node.type] || node.type}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {nodes.length === 0 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#475569', fontSize: 14, pointerEvents: 'none' }}>
          双击空白处添加节点
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)', backdropFilter: 'blur(8px)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 12, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '8px 14px', border: '1px solid rgba(99,102,241,0.15)', backdropFilter: 'blur(8px)' }}>
        {Object.entries(NODE_COLOR).map(([type, color]) => (
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
