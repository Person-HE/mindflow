import { useState, useMemo } from 'react';
import { useMindFlowStore } from '../store/useMindFlowStore';
import type { Node } from '../types';
import { FiX, FiTrash2, FiEdit3, FiLink, FiTag, FiClock } from 'react-icons/fi';

const nodeTypeOptions: { value: Node['type']; label: string }[] = [
  { value: 'entity', label: '实体' },
  { value: 'concept', label: '概念' },
  { value: 'module', label: '模块' },
  { value: 'atomic', label: '原子' },
];

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function NodeDetailPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const { currentProject, updateNode, deleteNode, selectNode } = useMindFlowStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  const node = useMemo(() => {
    return currentProject?.nodes.find((n) => n.id === nodeId) ?? null;
  }, [currentProject, nodeId]);

  const connectedNodes = useMemo(() => {
    if (!node || !currentProject) return [];
    return node.connections
      .map((cid) => currentProject.nodes.find((n) => n.id === cid))
      .filter((n): n is Node => n !== undefined);
  }, [node, currentProject]);

  if (!node) return null;

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(nodeId, { label: e.target.value });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNode(nodeId, { type: e.target.value as Node['type'] });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNode(nodeId, { description: e.target.value });
  };

  const handlePropertyKeyChange = (key: string, newKey: string) => {
    const entries = Object.entries(node.properties).map(([k, v]) => (k === key ? [newKey, v] : [k, v]));
    updateNode(nodeId, { properties: Object.fromEntries(entries) });
  };

  const handlePropertyValueChange = (key: string, value: string) => {
    updateNode(nodeId, { properties: { ...node.properties, [key]: value } });
  };

  const handleAddProperty = () => {
    if (!newPropKey.trim()) return;
    updateNode(nodeId, { properties: { ...node.properties, [newPropKey.trim()]: newPropValue } });
    setNewPropKey('');
    setNewPropValue('');
  };

  const handleRemoveProperty = (key: string) => {
    const { [key]: _, ...rest } = node.properties;
    updateNode(nodeId, { properties: rest });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteNode(nodeId);
    onClose();
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 0',
    borderBottom: '1px solid var(--color-border-light)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--color-text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-light)',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
  };

  const smallBtnStyle = (color: string): React.CSSProperties => ({
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    color,
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background var(--transition-fast)',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '360px',
        height: '100%',
        background: 'rgba(15, 15, 35, 0.95)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        animation: 'slideInRight 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiEdit3 style={{ fontSize: '16px', color: 'var(--color-primary-light)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            节点详情
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-muted)';
          }}
        >
          <FiX style={{ fontSize: '18px' }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        <div style={sectionStyle}>
          <span style={labelStyle}>节点名称</span>
          <input
            type="text"
            value={node.label}
            onChange={handleLabelChange}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-light)';
            }}
          />
        </div>

        <div style={sectionStyle}>
          <span style={labelStyle}>节点类型</span>
          <select
            value={node.type}
            onChange={handleTypeChange}
            style={{
              ...inputStyle,
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
          >
            {nodeTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={sectionStyle}>
          <span style={labelStyle}>描述</span>
          <textarea
            value={node.description ?? ''}
            onChange={handleDescriptionChange}
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.5',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-light)';
            }}
          />
        </div>

        <div style={sectionStyle}>
          <span style={labelStyle}>属性</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(node.properties).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => handlePropertyKeyChange(key, e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: '12px', padding: '6px 8px' }}
                />
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => handlePropertyValueChange(key, e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: '12px', padding: '6px 8px' }}
                />
                <button
                  onClick={() => handleRemoveProperty(key)}
                  style={smallBtnStyle('var(--color-danger, #ef4444)')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <FiX style={{ fontSize: '14px' }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="键"
              value={newPropKey}
              onChange={(e) => setNewPropKey(e.target.value)}
              style={{ ...inputStyle, flex: 1, fontSize: '12px', padding: '6px 8px' }}
            />
            <input
              type="text"
              placeholder="值"
              value={newPropValue}
              onChange={(e) => setNewPropValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddProperty();
              }}
              style={{ ...inputStyle, flex: 1, fontSize: '12px', padding: '6px 8px' }}
            />
            <button
              onClick={handleAddProperty}
              style={{
                ...smallBtnStyle('var(--color-primary-light, #818cf8)'),
                fontSize: '18px',
                fontWeight: 300,
                padding: '4px 8px',
              }}
            >
              +
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <span style={labelStyle}>
            <FiLink style={{ fontSize: '13px' }} />
            关联节点 ({connectedNodes.length})
          </span>
          {connectedNodes.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '4px 0' }}>
              暂无关联节点
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {connectedNodes.map((cn) => (
                <button
                  key={cn.id}
                  onClick={() => selectNode(cn.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-bg-hover)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-bg-card)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background:
                        cn.type === 'entity'
                          ? '#60a5fa'
                          : cn.type === 'concept'
                          ? '#a78bfa'
                          : cn.type === 'module'
                          ? '#34d399'
                          : '#fbbf24',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{cn.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {nodeTypeOptions.find((o) => o.value === cn.type)?.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {node.metadata.tags.length > 0 && (
          <div style={sectionStyle}>
            <span style={labelStyle}>
              <FiTag style={{ fontSize: '13px' }} />
              标签
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {node.metadata.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--color-primary-light)',
                    fontSize: '11px',
                    fontWeight: 500,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={sectionStyle}>
          <span style={labelStyle}>
            <FiClock style={{ fontSize: '13px' }} />
            元数据
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>创建时间</span>
              <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatTimestamp(node.metadata.createdAt)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>更新时间</span>
              <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatTimestamp(node.metadata.updatedAt)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>重要程度</span>
              <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {node.metadata.importance}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border-light)',
        }}
      >
        <button
          onClick={handleDelete}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: confirmDelete ? '1px solid #ef4444' : '1px solid var(--color-border-light)',
            background: confirmDelete ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            color: confirmDelete ? '#ef4444' : 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!confirmDelete) {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!confirmDelete) {
              e.currentTarget.style.borderColor = 'var(--color-border-light)';
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <FiTrash2 style={{ fontSize: '14px' }} />
          {confirmDelete ? '确认删除此节点？' : '删除节点'}
        </button>
      </div>
    </div>
  );
}
