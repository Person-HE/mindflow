import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
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

const LAYER_ORDER = ['entity', 'concept', 'module', 'atomic'];

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function ArchitectureView() {
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

  const layers = useMemo(() => {
    if (!currentProject) return [] as { type: string; name: string; nodes: Node[] }[];
    const byType = new Map<string, Node[]>();
    currentProject.nodes.forEach(node => {
      const t = node.type || 'entity';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(node);
    });
    const result: { type: string; name: string; nodes: Node[] }[] = [];
    const seen = new Set<string>();
    LAYER_ORDER.forEach(type => {
      if (byType.has(type)) { result.push({ type, name: TYPE_LABELS[type] || type, nodes: byType.get(type)! }); seen.add(type); }
    });
    byType.forEach((nodes, type) => {
      if (!seen.has(type)) result.push({ type, name: TYPE_LABELS[type] || type, nodes });
    });
    return result;
  }, [currentProject]);

  const edges = useMemo(() => currentProject?.edges ?? [], [currentProject]);

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; layerIdx: number }>();
    layers.forEach((layer, li) => {
      const layerY = PAD + li * (LAYER_H + LAYER_GAP);
      const totalW = layer.nodes.length * (NODE_W + NODE_GAP) - NODE_GAP;
      const startX = LAYER_LABEL_W + PAD + 20;
      layer.nodes.forEach((node, ni) => {
        pos.set(node.id, {
          x: startX + ni * (NODE_W + NODE_GAP),
          y: layerY + (LAYER_H - NODE_H) / 2,
          layerIdx: li,
        });
      });
    });
    return pos;
  }, [layers]);

  const canvasH = PAD * 2 + layers.length * (LAYER_H + LAYER_GAP) - LAYER_GAP;

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
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(99,102,241,0.02) 0%, transparent 50%), #0a0a1a', position: 'relative' }}>
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
          return (
            <g key={layer.type}>
              <rect
                x={PAD}
                y={layerY}
                width={Math.max(600, layer.nodes.length * (NODE_W + NODE_GAP) + LAYER_LABEL_W + 60)}
                height={LAYER_H}
                rx={10}
                fill={hexToRgba(color, 0.03)}
                stroke={hexToRgba(color, 0.12)}
                strokeWidth={1}
              />
              <rect x={PAD} y={layerY} width={LAYER_LABEL_W} height={LAYER_H} rx={10} fill={hexToRgba(color, 0.06)} />
              <text
                x={PAD + LAYER_LABEL_W / 2}
                y={layerY + LAYER_H / 2 - 8}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={12}
                fontWeight={700}
              >
                {layer.name}
              </text>
              <text
                x={PAD + LAYER_LABEL_W / 2}
                y={layerY + LAYER_H / 2 + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#64748b"
                fontSize={10}
              >
                {layer.nodes.length} 节点
              </text>

              {layer.nodes.map((node, ni) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;
                const isSelected = selectedNodeId === node.id;
                return (
                  <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => selectNode(node.id)}>
                    {isSelected && (
                      <rect x={pos.x - 3} y={pos.y - 3} width={NODE_W + 6} height={NODE_H + 6} rx={10} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
                    )}
                    <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8} fill={isSelected ? hexToRgba(color, 0.15) : '#0f172a'} stroke={isSelected ? color : hexToRgba(color, 0.3)} strokeWidth={isSelected ? 2 : 1} />
                    <circle cx={pos.x + 14} cy={pos.y + NODE_H / 2} r={4} fill={color} />
                    <text x={pos.x + 26} y={pos.y + NODE_H / 2} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
                      {node.label.length > 8 ? node.label.substring(0, 8) + '…' : node.label}
                    </text>
                  </g>
                );
              })}

              {li < layers.length - 1 && (
                <g>
                  <line x1={PAD + 300} y1={layerY + LAYER_H} x2={PAD + 300} y2={layerY + LAYER_H + LAYER_GAP} stroke="rgba(99,102,241,0.15)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arch-arrow)" />
                </g>
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
          const sy = sp.y + NODE_H;
          const tx = tp.x + NODE_W / 2;
          const ty = tp.y;
          if (isSameLayer) {
            const my = sp.y + NODE_H / 2;
            return (
              <path
                key={edge.id}
                d={`M${sp.x + NODE_W},${my} C${sp.x + NODE_W + 30},${my} ${tp.x - 30},${my} ${tp.x},${my}`}
                fill="none"
                stroke="rgba(168,85,247,0.2)"
                strokeWidth={1}
                strokeDasharray="4,3"
              />
            );
          }
          return (
            <g key={edge.id}>
              <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="rgba(99,102,241,0.2)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arch-arrow)" />
              {edge.label && (
                <g transform={`translate(${(sx + tx) / 2},${(sy + ty) / 2})`}>
                  <rect x={-edge.label.length * 4 - 4} y={-8} width={edge.label.length * 8 + 8} height={16} rx={4} fill="rgba(15,23,42,0.85)" stroke="rgba(99,102,241,0.1)" strokeWidth={0.5} />
                  <text textAnchor="middle" dominantBaseline="central" fill="rgba(148,163,184,0.7)" fontSize={8}>{edge.label}</text>
                </g>
              )}
            </g>
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
