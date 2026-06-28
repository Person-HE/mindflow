import { useEffect } from 'react';
import { useMindFlowStore } from '../store/useMindFlowStore';
import type { ViewType } from '../types';
import { FiList, FiShare2, FiGrid, FiDatabase, FiLayers, FiChevronRight } from 'react-icons/fi';

const viewIcons: Record<ViewType, React.ReactNode> = {
  tree: <FiList />,
  network: <FiShare2 />,
  kanban: <FiGrid />,
  knowledge: <FiDatabase />,
  architecture: <FiLayers />,
  breakdown: <FiChevronRight />,
};

const viewLabels: Record<ViewType, string> = {
  tree: '层级树状图',
  network: '网络关系图',
  kanban: '结构化看板',
  knowledge: '增强知识图谱',
  architecture: '架构图',
  breakdown: '极致拆解视图',
};

export default function Sidebar() {
  const {
    activeView,
    setActiveView,
    currentProject,
    undo,
    redo,
    saveProject,
    undoStack,
    redoStack
  } = useMindFlowStore();

  const views: ViewType[] = ['tree', 'network', 'kanban', 'knowledge', 'architecture', 'breakdown'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          redo();
        } else if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 's') {
          e.preventDefault();
          saveProject();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, saveProject]);

  return (
    <aside style={{
      width: '240px',
      background: 'rgba(15, 15, 35, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRight: '1px solid var(--color-border-light)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '20px 16px',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--color-text-muted)',
          padding: '0 8px'
        }}>
          <span>视图切换</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {views.map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                color: activeView === view ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                transition: 'all var(--transition-fast)',
                fontSize: '13px',
                fontWeight: 500,
                textAlign: 'left',
                background: activeView === view ? 'rgba(99, 102, 241, 0.15)' : 'none',
                boxShadow: activeView === view ? 'inset 0 0 0 1px rgba(99, 102, 241, 0.3)' : 'none',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (activeView !== view) {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== view) {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <span style={{
                fontSize: '16px',
                width: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>{viewIcons[view]}</span>
              <span style={{ flex: 1 }}>{viewLabels[view]}</span>
              {activeView === view && <FiChevronRight style={{ fontSize: '14px', opacity: 0.7 }} />}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--color-text-muted)',
          padding: '0 8px'
        }}>
          <span>数据概览</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 8px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-primary-light)',
              fontFamily: 'var(--font-mono)'
            }}>{currentProject?.nodes.length || 0}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>节点</span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 8px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-primary-light)',
              fontFamily: 'var(--font-mono)'
            }}>{currentProject?.edges.length || 0}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>关系</span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '12px 8px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-primary-light)',
              fontFamily: 'var(--font-mono)'
            }}>{currentProject?.modules.length || 0}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>模块</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--color-text-muted)',
          padding: '0 8px'
        }}>
          <span>快捷操作</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={() => undo()}
            disabled={undoStack.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              color: undoStack.length === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              transition: 'all var(--transition-fast)',
              fontSize: '12px',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer',
              opacity: undoStack.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (undoStack.length > 0) {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = undoStack.length === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)';
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              color: 'var(--color-text-muted)'
            }}>⌘Z</span>
            <span style={{ flex: 1 }}>撤销</span>
          </button>
          <button
            onClick={() => redo()}
            disabled={redoStack.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              color: redoStack.length === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              transition: 'all var(--transition-fast)',
              fontSize: '12px',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer',
              opacity: redoStack.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (redoStack.length > 0) {
                e.currentTarget.style.background = 'var(--color-bg-hover)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = redoStack.length === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)';
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              color: 'var(--color-text-muted)'
            }}>⌘⇧Z</span>
            <span style={{ flex: 1 }}>重做</span>
          </button>
          <button
            onClick={() => saveProject()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              transition: 'all var(--transition-fast)',
              fontSize: '12px',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              padding: '2px 6px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              color: 'var(--color-text-muted)'
            }}>⌘S</span>
            <span style={{ flex: 1 }}>保存</span>
          </button>
        </div>
      </div>
    </aside>
  );
}