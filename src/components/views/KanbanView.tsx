import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
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

  const lanes = useMemo(() => {
    if (!currentProject) return [] as { key: string; nodes: Node[] }[];
    const grouped: Record<string, Node[]> = {};
    currentProject.nodes.forEach(node => {
      const category = node.metadata.tags[0] || node.type;
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(node);
    });
    return Object.entries(grouped).map(([key, nodes]) => ({ key, nodes }));
  }, [currentProject]);

  const edges = useMemo(() => currentProject?.edges ?? [], [currentProject]);

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; laneIdx: number; nodeIdx: number }>();
    lanes.forEach((lane, li) => {
      lane.nodes.forEach((node, ni) => {
        pos.set(node.id, { x: PAD + li * (LANE_W + LANE_GAP), y: PAD + HEADER_H + ni * (CARD_H + CARD_GAP), laneIdx: li, nodeIdx: ni });
      });
    });
    return pos;
  }, [lanes]);

  const canvasW = lanes.length * (LANE_W + LANE_GAP) + PAD * 2;
  const canvasH = Math.max(600, ...lanes.map(l => l.nodes.length * (CARD_H + CARD_GAP) + HEADER_H + PAD * 2 + 40));

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

  if (!currentProject || currentProject.nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a1a', color: '#64748b', fontSize: 14 }}>
        暂无数据
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a0a1a', position: 'relative' }}>
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
              <rect x={laneX} y={PAD} width={LANE_W} height={laneH} rx={10} fill="rgba(15,15,35,0.5)" stroke="rgba(99,102,241,0.12)" strokeWidth={1} />
              <rect x={laneX} y={PAD} width={LANE_W} height={HEADER_H} rx={10} fill="rgba(99,102,241,0.08)" />
              <rect x={laneX} y={PAD + HEADER_H - 1} width={LANE_W} height={2} fill="rgba(99,102,241,0.1)" />
              <text x={laneX + 16} y={PAD + HEADER_H / 2} dominantBaseline="central" fill="#e2e8f0" fontSize={13} fontWeight={600} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                {lane.key}
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
                const cardY = cy;
                return (
                  <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => selectNode(node.id)}>
                    {isSelected && (
                      <rect x={cx - 2} y={cardY - 2} width={CARD_W + 4} height={CARD_H + 4} rx={10} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
                    )}
                    <rect x={cx} y={cardY} width={CARD_W} height={CARD_H} rx={8} fill={isSelected ? hexToRgba(color, 0.12) : '#0f172a'} stroke={isSelected ? color : 'rgba(99,102,241,0.2)'} strokeWidth={isSelected ? 1.5 : 1} />
                    <circle cx={cx + 14} cy={cardY + 18} r={5} fill={color} />
                    <text x={cx + 26} y={cardY + 18} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={12} fontWeight={600} style={{ pointerEvents: 'none' }}>
                      {node.label.length > 10 ? node.label.substring(0, 10) + '…' : node.label}
                    </text>
                    <rect x={cx + 8} y={cardY + 34} width={TYPE_LABELS[node.type]?.length * 10 + 12} height={16} rx={8} fill={hexToRgba(color, 0.15)} stroke={hexToRgba(color, 0.3)} strokeWidth={0.5} />
                    <text x={cx + 14} y={cardY + 42} dominantBaseline="central" fill={color} fontSize={9} style={{ pointerEvents: 'none' }}>
                      {TYPE_LABELS[node.type] || node.type}
                    </text>
                    {ni < lane.nodes.length - 1 && (
                      <line x1={cx + CARD_W / 2} y1={cardY + CARD_H} x2={cx + CARD_W / 2} y2={cardY + CARD_H + CARD_GAP} stroke="rgba(99,102,241,0.12)" strokeWidth={1} />
                    )}
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
          if (sp.laneIdx === tp.laneIdx) return null;
          const midX = (sx + tx) / 2;
          return (
            <path
              key={edge.id}
              d={`M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`}
              fill="none"
              stroke="rgba(168,85,247,0.2)"
              strokeWidth={1}
              strokeDasharray="4,3"
            />
          );
        })}
      </svg>

      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>
    </div>
  );
}
