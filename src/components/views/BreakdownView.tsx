import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
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

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function BreakdownView() {
  const { currentProject, selectNode, selectedNodeId, viewZoom, setViewZoom, viewPan, setViewPan } = useMindFlowStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

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

  const rootNodeId = useMemo(() => {
    if (centerNodeId) return centerNodeId;
    const root = nodes.find(n => !n.parentId);
    return root?.id ?? nodes[0]?.id ?? null;
  }, [nodes, centerNodeId]);

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

    const directChildren = nodes.filter(n => n.parentId === rootNodeId);
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

    const connIds = new Set<string>();
    (cNode?.connections ?? []).forEach(cid => {
      if (!visited.has(cid)) {
        connIds.add(cid);
        const connNode = nodes.find(n => n.id === cid);
        if (connNode) {
          const angle = Math.PI * 2 * (connIds.size) / (cNode?.connections.length || 1) - Math.PI / 2;
          const r = RING_R[1] || 140;
          positions.set(connNode.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), ring: 1 });
          rings.push({ node: connNode, ring: 1, angle });
          visited.add(connNode.id);
        }
      }
    });

    while (queue.length > 0) {
      const { id: parentId, ring } = queue.shift()!;
      if (ring >= 2) continue;
      const parentPos = positions.get(parentId);
      if (!parentPos) continue;
      const children = nodes.filter(n => n.parentId === parentId && !visited.has(n.id));
      const childSpread = Math.min(Math.PI * 0.6, children.length * 0.25);
      const parentAngle = Math.atan2(parentPos.y - cy, parentPos.x - cx);
      const childStart = parentAngle - childSpread / 2;

      children.forEach((child, i) => {
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
  }, [nodes, rootNodeId]);

  const viewBox = useMemo(() => {
    const cx = svgSize.w / 2 / viewZoom;
    const cy = svgSize.h / 2 / viewZoom;
    return `${-viewPan.x - cx} ${-viewPan.y - cy} ${svgSize.w / viewZoom} ${svgSize.h / viewZoom}`;
  }, [viewPan, viewZoom, svgSize]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setViewZoom(viewZoom + (e.deltaY > 0 ? -0.1 : 0.1));
  }, [viewZoom, setViewZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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

  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
    const hasChildren = nodes.some(n => n.parentId === nodeId);
    if (hasChildren || nodes.find(n => n.id === nodeId)?.connections?.length) {
      if (centerNodeId) setNavStack(prev => [...prev, centerNodeId]);
      setCenterNodeId(nodeId);
    }
  }, [nodes, centerNodeId, selectNode]);

  const handleBack = useCallback(() => {
    if (navStack.length > 0) {
      const prev = navStack[navStack.length - 1];
      setNavStack(s => s.slice(0, -1));
      setCenterNodeId(prev);
    } else {
      const root = nodes.find(n => !n.parentId);
      if (root) setCenterNodeId(root.id);
    }
  }, [navStack, nodes]);

  if (!currentProject || nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a1a', color: '#64748b', fontSize: 14 }}>
        暂无数据
      </div>
    );
  }

  const maxRing = ringNodes.length > 0 ? Math.max(...ringNodes.map(r => r.ring)) : 0;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 50%), #0a0a1a', position: 'relative' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        style={{ display: 'block', userSelect: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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

        {centerNode && ringNodes.map(({ node, ring }) => {
          const pos = allChildPositions.get(node.id);
          if (!pos) return null;
          return (
            <line
              key={`line-${node.id}`}
              x1={0}
              y1={0}
              x2={pos.x}
              y2={pos.y}
              stroke={hexToRgba(TYPE_COLORS[node.type] || '#6366f1', 0.15)}
              strokeWidth={1}
            />
          );
        })}

        {ringNodes.map(({ node, ring }) => {
          const pos = allChildPositions.get(node.id);
          if (!pos) return null;
          const isSelected = selectedNodeId === node.id;
          const color = TYPE_COLORS[node.type] || '#6366f1';
          const r = CHILD_R;
          return (
            <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
              )}
              <circle cx={pos.x} cy={pos.y} r={r} fill="#0f172a" stroke={color} strokeWidth={isSelected ? 2 : 1} />
              <circle cx={pos.x} cy={pos.y} r={r} fill={hexToRgba(color, 0.08)} />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={9} fontWeight={600} style={{ pointerEvents: 'none' }}>
                {node.label.length > 4 ? node.label.substring(0, 4) + '…' : node.label}
              </text>
              <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" dominantBaseline="central" fill="rgba(100,116,139,0.5)" fontSize={7} style={{ pointerEvents: 'none' }}>
                {node.type}
              </text>
            </g>
          );
        })}

        {centerNode && (() => {
          const isSelected = selectedNodeId === centerNode.id;
          const color = TYPE_COLORS[centerNode.type] || '#6366f1';
          return (
            <g style={{ cursor: 'pointer' }} onClick={() => selectNode(centerNode.id)}>
              {isSelected && (
                <circle cx={0} cy={0} r={CENTER_R + 8} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
              )}
              <circle cx={0} cy={0} r={CENTER_R} fill="#0f172a" stroke={color} strokeWidth={2.5} filter="url(#centerGlow)" />
              <circle cx={0} cy={0} r={CENTER_R} fill={hexToRgba(color, 0.12)} />
              <text x={0} y={-4} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
                {centerNode.label.length > 6 ? centerNode.label.substring(0, 6) + '…' : centerNode.label}
              </text>
              <text x={0} y={12} textAnchor="middle" dominantBaseline="central" fill="rgba(148,163,184,0.6)" fontSize={8} style={{ pointerEvents: 'none' }}>
                {centerNode.type}
              </text>
            </g>
          );
        })()}
      </svg>

      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>

      {navStack.length > 0 && (
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 8,
            color: '#a5b4fc',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}
        >
          ← 返回上级
        </button>
      )}
    </div>
  );
}
