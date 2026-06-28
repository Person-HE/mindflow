import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import type { Module, Node } from '../../types';

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

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function KnowledgeView() {
  const { currentProject, selectNode, selectedNodeId, viewZoom, setViewZoom, viewPan, setViewPan } = useMindFlowStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 1200, h: 800 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

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

  const { modLayouts, ungrouped, ungroupedPos, nodePositions } = useMemo(() => {
    const modMap = new Map<string, { mod: Module; nodeIds: string[]; x: number; y: number; w: number; h: number; color: string }>();
    const nPos = new Map<string, { x: number; y: number }>();
    let curX = 40;
    let curY = 40;

    modules.forEach((mod, mi) => {
      const modNodes = nodes.filter(n => mod.nodeIds.includes(n.id));
      const cols = Math.ceil(Math.sqrt(modNodes.length));
      const rows = Math.ceil(modNodes.length / cols);
      const w = Math.max(200, cols * NODE_GAP + MOD_PAD * 2);
      const h = MOD_HEADER + rows * NODE_GAP + MOD_PAD;
      const color = mod.color || MODULE_COLORS[mi % MODULE_COLORS.length];

      modMap.set(mod.id, { mod, nodeIds: mod.nodeIds, x: curX, y: curY, w, h, color });

      modNodes.forEach((node, ni) => {
        const col = ni % cols;
        const row = Math.floor(ni / cols);
        const nx = curX + MOD_PAD + col * NODE_GAP + NODE_GAP / 2;
        const ny = curY + MOD_HEADER + row * NODE_GAP + NODE_GAP / 2;
        nPos.set(node.id, { x: nx, y: ny });
      });

      curX += w + 40;
      if (curX > 800) { curX = 40; curY += h + 40; }
    });

    const groupedIds = new Set(modules.flatMap(m => m.nodeIds));
    const ungrouped = nodes.filter(n => !groupedIds.has(n.id));
    const uPos = new Map<string, { x: number; y: number }>();
    const uStartY = curY;
    ungrouped.forEach((node, i) => {
      const px = 40 + (i % 8) * NODE_GAP;
      const py = uStartY + Math.floor(i / 8) * NODE_GAP;
      uPos.set(node.id, { x: px, y: py });
      nPos.set(node.id, { x: px, y: py });
    });

    return { modLayouts: modMap, ungrouped, ungroupedPos: uPos, nodePositions: nPos };
  }, [modules, nodes]);

  const viewBox = useMemo(() => {
    return `${-viewPan.x} ${-viewPan.y} ${svgSize.w / viewZoom} ${svgSize.h / viewZoom}`;
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

  if (!currentProject || nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a1a', color: '#64748b', fontSize: 14 }}>
        暂无数据
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.04) 0%, transparent 40%), #0a0a1a', position: 'relative' }}>
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
          <pattern id="know-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#know-grid)" />

        {Array.from(modLayouts.values()).map((layout) => (
          <g key={layout.mod.id}>
            <rect
              x={layout.x}
              y={layout.y}
              width={layout.w}
              height={layout.h}
              rx={12}
              fill="rgba(15,15,35,0.4)"
              stroke={hexToRgba(layout.color, 0.35)}
              strokeWidth={2}
              strokeDasharray="8,4"
            />
            <rect x={layout.x} y={layout.y} width={layout.w} height={MOD_HEADER} rx={12} fill={hexToRgba(layout.color, 0.08)} />
            <rect x={layout.x} y={layout.y + MOD_HEADER - 2} width={layout.w} height={2} fill={hexToRgba(layout.color, 0.15)} />
            <text x={layout.x + 16} y={layout.y + MOD_HEADER / 2} dominantBaseline="central" fill={layout.color} fontSize={13} fontWeight={600} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
              {layout.mod.label}
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
          const isCrossModule = !modules.some(m => m.nodeIds.includes(edge.source) && m.nodeIds.includes(edge.target));
          return (
            <g key={edge.id}>
              <line
                x1={sp.x}
                y1={sp.y}
                x2={tp.x}
                y2={tp.y}
                stroke={isCrossModule ? 'rgba(168,85,247,0.25)' : 'rgba(99,102,241,0.2)'}
                strokeWidth={isCrossModule ? 1.5 : 1}
                strokeDasharray={isCrossModule ? '6,3' : '3,3'}
              />
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
            <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => selectNode(node.id)}>
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
              )}
              <circle cx={pos.x} cy={pos.y} r={NODE_R} fill="#0f172a" stroke={color} strokeWidth={isSelected ? 2 : 1} />
              <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={hexToRgba(color, 0.1)} />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={9} fontWeight={600} style={{ pointerEvents: 'none' }}>
                {node.label.length > 5 ? node.label.substring(0, 5) + '…' : node.label}
              </text>
              <text x={pos.x} y={pos.y + NODE_R + 12} textAnchor="middle" dominantBaseline="central" fill="rgba(100,116,139,0.6)" fontSize={8} style={{ pointerEvents: 'none' }}>
                {node.type}
              </text>
            </g>
          );
        })}

        {ungrouped.length > 0 && (
          <g>
            <rect
              x={20}
              y={Array.from(modLayouts.values()).reduce((max, l) => Math.max(max, l.y + l.h), 40) + 20}
              width={8 * NODE_GAP + 40}
              height={Math.ceil(ungrouped.length / 8) * NODE_GAP + 40}
              rx={12}
              fill="none"
              stroke="rgba(100,116,139,0.15)"
              strokeWidth={1}
              strokeDasharray="6,4"
            />
            <text x={36} y={Array.from(modLayouts.values()).reduce((max, l) => Math.max(max, l.y + l.h), 40) + 36} dominantBaseline="central" fill="#64748b" fontSize={11}>
              未分组
            </text>
          </g>
        )}
      </svg>

      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>
    </div>
  );
}
