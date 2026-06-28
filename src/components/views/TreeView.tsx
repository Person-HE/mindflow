import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import type { Node } from '../../types';

interface TreeNode extends Node {
  treeChildren: TreeNode[];
  layoutX: number;
  layoutY: number;
}

const NODE_W = 140;
const NODE_H = 44;
const H_GAP = 80;
const V_GAP = 16;
const PAD = 60;

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

export default function TreeView() {
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

  const { treeRoots, flatNodes, positions, canvasW, canvasH } = useMemo(() => {
    if (!currentProject) return { treeRoots: [] as TreeNode[], flatNodes: [] as Node[], positions: new Map<string, { x: number; y: number }>(), canvasW: 800, canvasH: 600 };

    const nodes = currentProject.nodes;
    const buildTree = (node: Node): TreeNode => {
      const children = nodes.filter(n => n.parentId === node.id).map(buildTree);
      return { ...node, treeChildren: children, layoutX: 0, layoutY: 0 };
    };

    const roots = nodes.filter(n => !n.parentId).map(buildTree);
    const pos = new Map<string, { x: number; y: number }>();

    let leafIndex = 0;
    const assignPositions = (tn: TreeNode, depth: number) => {
      if (tn.treeChildren.length === 0) {
        tn.layoutX = depth * (NODE_W + H_GAP) + PAD;
        tn.layoutY = leafIndex * (NODE_H + V_GAP) + PAD;
        pos.set(tn.id, { x: tn.layoutX, y: tn.layoutY });
        leafIndex++;
        return;
      }
      tn.treeChildren.forEach(child => assignPositions(child, depth + 1));
      const firstChild = tn.treeChildren[0];
      const lastChild = tn.treeChildren[tn.treeChildren.length - 1];
      tn.layoutX = depth * (NODE_W + H_GAP) + PAD;
      tn.layoutY = (firstChild.layoutY + lastChild.layoutY) / 2;
      pos.set(tn.id, { x: tn.layoutX, y: tn.layoutY });
    };

    roots.forEach(r => assignPositions(r, 0));

    const allPos = Array.from(pos.values());
    const maxX = allPos.length > 0 ? Math.max(...allPos.map(p => p.x)) + NODE_W + PAD : 800;
    const maxY = allPos.length > 0 ? Math.max(...allPos.map(p => p.y)) + NODE_H + PAD : 600;

    return { treeRoots: roots, flatNodes: nodes, positions: pos, canvasW: maxX, canvasH: maxY };
  }, [currentProject]);

  const hasTree = treeRoots.length > 0 && treeRoots.some(r => r.treeChildren.length > 0 || treeRoots.length > 1);

  const viewBox = useMemo(() => {
    return `${-viewPan.x} ${-viewPan.y} ${svgSize.w / viewZoom} ${svgSize.h / viewZoom}`;
  }, [viewPan, viewZoom, svgSize]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setViewZoom(viewZoom + delta);
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

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const renderEdge = (parent: TreeNode) => {
    return parent.treeChildren.map(child => {
      const px = parent.layoutX + NODE_W;
      const py = parent.layoutY + NODE_H / 2;
      const cx = child.layoutX;
      const cy = child.layoutY + NODE_H / 2;
      const midX = (px + cx) / 2;
      return (
        <path
          key={`edge-${parent.id}-${child.id}`}
          d={`M${px},${py} C${midX},${py} ${midX},${cy} ${cx},${cy}`}
          fill="none"
          stroke="rgba(99,102,241,0.3)"
          strokeWidth={1.5}
        />
      );
    });
  };

  const renderNode = (tn: TreeNode) => {
    const isSelected = selectedNodeId === tn.id;
    const color = TYPE_COLORS[tn.type] || '#6366f1';
    const x = tn.layoutX;
    const y = tn.layoutY;
    return (
      <g key={tn.id} style={{ cursor: 'pointer' }} onClick={() => selectNode(tn.id)}>
        {isSelected && (
          <rect
            x={x - 3}
            y={y - 3}
            width={NODE_W + 6}
            height={NODE_H + 6}
            rx={10}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="4,3"
          />
        )}
        <rect
          x={x}
          y={y}
          width={NODE_W}
          height={NODE_H}
          rx={8}
          fill={isSelected ? hexToRgba(color, 0.15) : '#0f172a'}
          stroke={isSelected ? color : hexToRgba(color, 0.4)}
          strokeWidth={isSelected ? 2 : 1}
        />
        <circle cx={x + 16} cy={y + NODE_H / 2} r={5} fill={color} />
        <text
          x={x + 30}
          y={y + NODE_H / 2}
          dominantBaseline="central"
          fill={isSelected ? '#ffffff' : '#e2e8f0'}
          fontSize={12}
          fontWeight={600}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {tn.label.length > 10 ? tn.label.substring(0, 10) + '…' : tn.label}
        </text>
        <text
          x={x + NODE_W - 8}
          y={y + NODE_H / 2}
          dominantBaseline="central"
          textAnchor="end"
          fill="rgba(148,163,184,0.6)"
          fontSize={9}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {tn.type}
        </text>
        {renderEdge(tn)}
        {tn.treeChildren.map(child => renderNode(child))}
      </g>
    );
  };

  const renderFlatNodes = () => {
    const colW = NODE_W + 20;
    const rowH = NODE_H + 12;
    return flatNodes.map((node, i) => {
      const isSelected = selectedNodeId === node.id;
      const color = TYPE_COLORS[node.type] || '#6366f1';
      const x = PAD;
      const y = PAD + i * rowH;
      return (
        <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => selectNode(node.id)}>
          {isSelected && (
            <rect x={x - 3} y={y - 3} width={colW + 6} height={NODE_H + 6} rx={10} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />
          )}
          <rect x={x} y={y} width={colW} height={NODE_H} rx={8} fill={isSelected ? hexToRgba(color, 0.15) : '#0f172a'} stroke={isSelected ? color : hexToRgba(color, 0.4)} strokeWidth={isSelected ? 2 : 1} />
          <circle cx={x + 16} cy={y + NODE_H / 2} r={5} fill={color} />
          <text x={x + 30} y={y + NODE_H / 2} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={12} fontWeight={600} style={{ pointerEvents: 'none' }}>
            {node.label.length > 12 ? node.label.substring(0, 12) + '…' : node.label}
          </text>
          {i < flatNodes.length - 1 && (
            <line x1={x + colW / 2} y1={y + NODE_H} x2={x + colW / 2} y2={y + rowH} stroke="rgba(99,102,241,0.15)" strokeWidth={1} strokeDasharray="3,3" />
          )}
        </g>
      );
    });
  };

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
          <pattern id="tree-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#tree-grid)" />
        {hasTree ? treeRoots.map(root => renderNode(root)) : renderFlatNodes()}
      </svg>
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '6px 4px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom + 0.2)}>+</button>
        <div style={{ fontSize: 10, color: '#64748b', padding: '2px 0', userSelect: 'none' }}>{Math.round(viewZoom * 100)}%</div>
        <button style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 6, cursor: 'pointer', fontSize: 16, fontWeight: 600 }} onClick={() => setViewZoom(viewZoom - 0.2)}>−</button>
      </div>
    </div>
  );
}
