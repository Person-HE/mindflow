import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '../../types';

const CENTER_R = 36;
const RING_R: Record<number, number> = { 1: 140, 2: 260, 3: 360 };
const CHILD_R = 22;

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

export default function BreakdownView() {
  const { currentProject, selectNode, selectedNodeId, viewZoom, setViewZoom, viewPan, setViewPan, addNode, updateNode, deleteNode, addEdge } = useMindFlowStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; nodeId: string | null }>({ visible: false, x: 0, y: 0, nodeId: null });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [centerNodeId, setCenterNodeId] = useState<string | null>(null);
  const [navStack, setNavStack] = useState<string[]>([]);

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

  const hasParentId = nodes.some(n => n.parentId && nodes.find(x => x.id === n.parentId));

  const rootNodeId = useMemo(() => {
    if (centerNodeId) return centerNodeId;
    if (nodes.length === 0) return null;
    if (hasParentId) {
      const root = nodes.find(n => !n.parentId);
      return root?.id ?? nodes[0].id;
    }
    const connCount = new Map<string, number>();
    nodes.forEach(n => { connCount.set(n.id, n.connections?.length ?? 0); });
    edges.forEach(e => {
      connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
      connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
    });
    let maxId = nodes[0].id;
    let maxCount = -1;
    nodes.forEach(n => {
      const c = connCount.get(n.id) ?? 0;
      if (c > maxCount) { maxCount = c; maxId = n.id; }
    });
    return maxId;
  }, [nodes, edges, centerNodeId, hasParentId]);

  const { centerNode, ringNodes, allChildPositions } = useMemo(() => {
    if (!rootNodeId) return { centerNode: null as Node | null, ringNodes: [] as { node: Node; ring: number; angle: number }[], allChildPositions: new Map<string, { x: number; y: number; ring: number }>() };

    const cNode = nodes.find(n => n.id === rootNodeId) ?? null;
    const positions = new Map<string, { x: number; y: number; ring: number }>();
    const rings: { node: Node; ring: number; angle: number }[] = [];
    const cx = 0;
    const cy = 0;
    if (cNode) positions.set(cNode.id, { x: cx, y: cy, ring: 0 });

    const visited = new Set<string>([rootNodeId]);
    const queue: { id: string; ring: number }[] = [];

    let directChildren: Node[] = [];
    if (hasParentId) {
      directChildren = nodes.filter(n => n.parentId === rootNodeId);
    } else {
      const connIds = new Set<string>();
      (cNode?.connections ?? []).forEach(cid => { if (!visited.has(cid)) connIds.add(cid); });
      edges.forEach(e => {
        if (e.source === rootNodeId && !visited.has(e.target)) connIds.add(e.target);
        if (e.target === rootNodeId && !visited.has(e.source)) connIds.add(e.source);
      });
      directChildren = nodes.filter(n => connIds.has(n.id));
      if (directChildren.length === 0 && nodes.length > 1) {
        directChildren = nodes.filter(n => n.id !== rootNodeId);
      }
    }

    const spreadAngle = Math.min(Math.PI * 2, directChildren.length * 0.4);
    const startAngle = -spreadAngle / 2 - Math.PI / 2;

    directChildren.forEach((child, i) => {
      const angle = directChildren.length === 1 ? -Math.PI / 2 : startAngle + (spreadAngle / (directChildren.length - 1 || 1)) * i;
      const r = RING_R[1] || 140;
      positions.set(child.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ring: 1 });
      rings.push({ node: child, ring: 1, angle });
      visited.add(child.id);
      queue.push({ id: child.id, ring: 1 });
    });

    while (queue.length > 0) {
      const { id: parentId, ring } = queue.shift()!;
      if (ring >= 2) continue;
      const parentPos = positions.get(parentId);
      if (!parentPos) continue;
      let children: Node[] = [];
      if (hasParentId) {
        children = nodes.filter(n => n.parentId === parentId && !visited.has(n.id));
      } else {
        const parent = nodes.find(n => n.id === parentId);
        const childConnIds = new Set<string>();
        (parent?.connections ?? []).forEach(cid => { if (!visited.has(cid)) childConnIds.add(cid); });
        edges.forEach(e => {
          if (e.source === parentId && !visited.has(e.target)) childConnIds.add(e.target);
          if (e.target === parentId && !visited.has(e.source)) childConnIds.add(e.source);
        });
        children = nodes.filter(n => childConnIds.has(n.id));
      }
      const childSpread = Math.min(Math.PI * 0.6, children.length * 0.25);
      const parentAngle = Math.atan2(parentPos.y - cy, parentPos.x - cx);
      const childStart = parentAngle - childSpread / 2;

      children.forEach((child, i) => {
        if (visited.has(child.id)) return;
        const angle = children.length === 1 ? parentAngle : childStart + (childSpread / (children.length - 1 || 1)) * i;
        const nextRing = ring + 1;
        const r = RING_R[nextRing] || (140 + nextRing * 120);
        positions.set(child.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ring: nextRing });
        rings.push({ node: child, ring: nextRing, angle });
        visited.add(child.id);
        queue.push({ id: child.id, ring: nextRing });
      });
    }

    return { centerNode: cNode, ringNodes: rings, allChildPositions: positions };
  }, [nodes, edges, rootNodeId, hasParentId]);

  const cx = svgSize.w / 2 / viewZoom;
  const cy = svgSize.h / 2 / viewZoom;
  const viewBox = `${-viewPan.x - cx} ${-viewPan.y - cy} ${svgSize.w / viewZoom} ${svgSize.h / viewZoom}`;

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const halfW = svgSize.w / 2 / viewZoom;
    const halfH = svgSize.h / 2 / viewZoom;
    return {
      x: -viewPan.x - halfW + ((clientX - rect.left) / rect.width) * (svgSize.w / viewZoom),
      y: -viewPan.y - halfH + ((clientY - rect.top) / rect.height) * (svgSize.h / viewZoom),
    };
  }, [viewPan, viewZoom, svgSize]);

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
    const x = (parent?.position?.x ?? 0) + 200;
    const y = (parent?.position?.y ?? 0) + 100;
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
      const node = nodes.find(n => n.id === nodeId);
      const hasChildren = nodes.some(n => n.parentId === nodeId);
      const hasConnections = (node?.connections?.length ?? 0) > 0 || edges.some(e => e.source === nodeId || e.target === nodeId);
      if (nodeId !== rootNodeId && (hasChildren || hasConnections || nodes.length > 1)) {
        if (centerNodeId) setNavStack(prev => [...prev, centerNodeId]);
        setCenterNodeId(nodeId);
      }
    }
  }, [connectFrom, addEdge, selectNode, nodes, edges, centerNodeId, rootNodeId]);

  const handleBack = useCallback(() => {
    if (navStack.length > 0) {
      const prev = navStack[navStack.length - 1];
      setNavStack(s => s.slice(0, -1));
      setCenterNodeId(prev);
    } else {
      setCenterNodeId(null);
    }
  }, [navStack]);

  const maxRing = ringNodes.length > 0 ? Math.max(...ringNodes.map(r => r.ring)) : 0;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), #0a0a1a', position: 'relative' }} onContextMenu={handleContextMenu}>
      <svg width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <pattern id="break-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
          <filter id="centerGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#6366f1" floodOpacity="0.3" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#break-grid)" />

        {[1, 2, 3].map(ring => (
          ring <= maxRing && (
            <circle key={ring} cx={0} cy={0} r={RING_R[ring] || 140 + ring * 120} fill="none" stroke="rgba(99,102,241,0.06)" strokeWidth={1} strokeDasharray="4,6" />
          )
        ))}

        {centerNode && ringNodes.map(({ node }) => {
          const pos = allChildPositions.get(node.id);
          if (!pos) return null;
          return <line key={`line-${node.id}`} x1={0} y1={0} x2={pos.x} y2={pos.y} stroke={hexToRgba(TYPE_COLORS[node.type] || '#6366f1', 0.15)} strokeWidth={1} />;
        })}

        {ringNodes.map(({ node }) => {
          const pos = allChildPositions.get(node.id);
          if (!pos) return null;
          const isSelected = selectedNodeId === node.id;
          const color = TYPE_COLORS[node.type] || '#6366f1';
          const r = CHILD_R;
          return (
            <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
              {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />}
              <circle cx={pos.x} cy={pos.y} r={r} fill="#0f172a" stroke={color} strokeWidth={isSelected ? 2 : 1} />
              <circle cx={pos.x} cy={pos.y} r={r} fill={hexToRgba(color, 0.08)} />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={9} fontWeight={600} style={{ pointerEvents: 'none' }}>
                {node.label.length > 4 ? node.label.substring(0, 4) + '…' : node.label}
              </text>
              <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={7} style={{ pointerEvents: 'none' }}>
                {TYPE_LABELS[node.type] || node.type}
              </text>
            </g>
          );
        })}

        {centerNode && (
          <g className="view-node" data-node-id={centerNode.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(centerNode.id)}>
            {selectedNodeId === centerNode.id && <circle cx={0} cy={0} r={CENTER_R + 8} fill="none" stroke={TYPE_COLORS[centerNode.type] || '#6366f1'} strokeWidth={2} strokeDasharray="4,3" />}
            <circle cx={0} cy={0} r={CENTER_R} fill="#0f172a" stroke={TYPE_COLORS[centerNode.type] || '#6366f1'} strokeWidth={2.5} filter="url(#centerGlow)" />
            <circle cx={0} cy={0} r={CENTER_R} fill={hexToRgba(TYPE_COLORS[centerNode.type] || '#6366f1', 0.12)} />
            <text x={0} y={-4} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
              {centerNode.label.length > 6 ? centerNode.label.substring(0, 6) + '…' : centerNode.label}
            </text>
            <text x={0} y={12} textAnchor="middle" dominantBaseline="central" fill={TYPE_COLORS[centerNode.type] || '#6366f1'} fontSize={8} style={{ pointerEvents: 'none' }}>
              {TYPE_LABELS[centerNode.type] || centerNode.type}
            </text>
          </g>
        )}
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

      {(navStack.length > 0 || centerNodeId) && (
        <button onClick={handleBack} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#a5b4fc', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(8px)' }}>
          ← 返回上级
        </button>
      )}

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
