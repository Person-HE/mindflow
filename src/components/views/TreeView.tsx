import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMindFlowStore } from '../../store/useMindFlowStore';
import { v4 as uuidv4 } from 'uuid';
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

export default function TreeView() {
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

  const { treeEdges, positions } = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const tEdges: { from: string; to: string }[] = [];
    if (nodes.length === 0) return { treeEdges: tEdges, positions: pos };

    const parentMap = new Map<string, string>();
    const hasValidParentId = nodes.some(n => n.parentId && nodes.find(x => x.id === n.parentId));
    if (hasValidParentId) {
      nodes.forEach(n => { if (n.parentId && nodes.find(x => x.id === n.parentId)) parentMap.set(n.id, n.parentId); });
    } else if (edges.length > 0) {
      edges.forEach(e => {
        if (nodes.find(n => n.id === e.source) && nodes.find(n => n.id === e.target)) parentMap.set(e.target, e.source);
      });
    } else if (nodes.length > 1) {
      const rootId = nodes[0].id;
      nodes.forEach(n => { if (n.id !== rootId) parentMap.set(n.id, rootId); });
    }

    const buildTree = (node: Node, visited: Set<string>): TreeNode => {
      if (visited.has(node.id)) return { ...node, treeChildren: [], layoutX: 0, layoutY: 0 };
      visited.add(node.id);
      const children = nodes.filter(n => parentMap.get(n.id) === node.id).map(c => buildTree(c, visited));
      return { ...node, treeChildren: children, layoutX: 0, layoutY: 0 };
    };

    const rootIds = nodes.filter(n => !parentMap.has(n.id)).map(n => n.id);
    const visited = new Set<string>();
    const roots = rootIds.map(id => nodes.find(n => n.id === id)).filter(Boolean).map(n => buildTree(n!, visited));

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
    roots.forEach(r => {
      assignPositions(r, 0);
      const collectEdges = (tn: TreeNode) => {
        tn.treeChildren.forEach(child => {
          tEdges.push({ from: tn.id, to: child.id });
          collectEdges(child);
        });
      };
      collectEdges(r);
    });

    const unvisited = nodes.filter(n => !visited.has(n.id));
    unvisited.forEach(n => {
      const y = leafIndex * (NODE_H + V_GAP) + PAD;
      pos.set(n.id, { x: PAD, y });
      leafIndex++;
    });

    return { treeEdges: tEdges, positions: pos };
  }, [nodes, edges]);

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

  const renderNode = (node: Node, x: number, y: number, w: number = NODE_W) => {
    const isSelected = selectedNodeId === node.id;
    const color = TYPE_COLORS[node.type] || '#6366f1';
    return (
      <g key={node.id} className="view-node" data-node-id={node.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(node.id)}>
        {isSelected && <rect x={x - 3} y={y - 3} width={w + 6} height={NODE_H + 6} rx={10} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4,3" />}
        <rect x={x} y={y} width={w} height={NODE_H} rx={8} fill={isSelected ? hexToRgba(color, 0.15) : '#0f172a'} stroke={isSelected ? color : hexToRgba(color, 0.4)} strokeWidth={isSelected ? 2 : 1} />
        <circle cx={x + 16} cy={y + NODE_H / 2} r={5} fill={color} />
        <text x={x + 30} y={y + NODE_H / 2} dominantBaseline="central" fill={isSelected ? '#ffffff' : '#e2e8f0'} fontSize={12} fontWeight={600} style={{ pointerEvents: 'none' }}>
          {node.label.length > 10 ? node.label.substring(0, 10) + '…' : node.label}
        </text>
        <text x={x + w - 8} y={y + NODE_H / 2} dominantBaseline="central" textAnchor="end" fill={color} fontSize={9} style={{ pointerEvents: 'none' }}>
          {TYPE_LABELS[node.type] || node.type}
        </text>
      </g>
    );
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0a0a1a', position: 'relative' }} onContextMenu={handleContextMenu}>
      <svg width="100%" height="100%" viewBox={viewBox} style={{ display: 'block', userSelect: 'none' }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <defs>
          <pattern id="tree-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#tree-grid)" />

        {treeEdges.map((e, i) => {
          const sp = positions.get(e.from);
          const tp = positions.get(e.to);
          if (!sp || !tp) return null;
          const px = sp.x + NODE_W;
          const py = sp.y + NODE_H / 2;
          const cx = tp.x;
          const cy = tp.y + NODE_H / 2;
          const midX = (px + cx) / 2;
          return <path key={`te-${i}`} d={`M${px},${py} C${midX},${py} ${midX},${cy} ${cx},${cy}`} fill="none" stroke="rgba(99,102,241,0.3)" strokeWidth={1.5} />;
        })}

        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return renderNode(node, pos.x, pos.y);
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
