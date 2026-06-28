import { useMindFlowStore } from '../store/useMindFlowStore';
import type { ViewType } from '../types';
import TreeView from './views/TreeView';
import NetworkView from './views/NetworkView';
import KanbanView from './views/KanbanView';
import KnowledgeView from './views/KnowledgeView';
import ArchitectureView from './views/ArchitectureView';
import BreakdownView from './views/BreakdownView';

const viewNames: Record<ViewType, string> = {
  tree: '层级树状图',
  network: '网络关系图',
  kanban: '结构化看板',
  knowledge: '增强知识图谱',
  architecture: '架构图',
  breakdown: '极致拆解视图',
};

interface VisualizationAreaProps {
  activeView: ViewType;
}

export default function VisualizationArea({ activeView }: VisualizationAreaProps) {
  const { currentProject, viewZoom, setViewZoom, viewPan, setViewPan } = useMindFlowStore();

  const handleZoomIn = () => {
    setViewZoom(viewZoom + 0.1);
  };

  const handleZoomOut = () => {
    setViewZoom(viewZoom - 0.1);
  };

  const handleZoomReset = () => {
    setViewZoom(1);
    setViewPan({ x: 0, y: 0 });
  };

  const renderView = () => {
    if (!currentProject || currentProject.nodes.length === 0) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
        }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '50%',
              color: '#818cf8',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px' }}>
                <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#e2e8f0',
              margin: '0 0 8px 0',
            }}>可视化区域</h3>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: 0,
            }}>在左侧输入你的想法，AI 将自动生成可视化结构</p>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'tree':
        return <TreeView />;
      case 'network':
        return <NetworkView />;
      case 'kanban':
        return <KanbanView />;
      case 'knowledge':
        return <KnowledgeView />;
      case 'architecture':
        return <ArchitectureView />;
      case 'breakdown':
        return <BreakdownView />;
      default:
        return <TreeView />;
    }
  };

  const controlBtnStyle = {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    color: '#94a3b8',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as const;

  const handleBtnHover = (e: React.MouseEvent<HTMLButtonElement>, hover: boolean) => {
    e.currentTarget.style.background = hover ? 'rgba(255, 255, 255, 0.08)' : 'none';
    e.currentTarget.style.color = hover ? '#e2e8f0' : '#94a3b8';
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a1a',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(15, 15, 35, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#e2e8f0',
          }}>{viewNames[activeView]}</span>
          <span style={{
            padding: '4px 10px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '9999px',
            fontSize: '11px',
            color: '#10b981',
            fontWeight: 500,
          }}>实时同步</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            padding: '4px 10px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#818cf8',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
          }}>{Math.round(viewZoom * 100)}%</div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={controlBtnStyle}
              title="放大"
              onClick={handleZoomIn}
              onMouseEnter={(e) => handleBtnHover(e, true)}
              onMouseLeave={(e) => handleBtnHover(e, false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                <path d="M12 6v12m-6-6h12" />
              </svg>
            </button>
            <button
              style={controlBtnStyle}
              title="缩小"
              onClick={handleZoomOut}
              onMouseEnter={(e) => handleBtnHover(e, true)}
              onMouseLeave={(e) => handleBtnHover(e, false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                <path d="M6 12h12" />
              </svg>
            </button>
            <button
              style={controlBtnStyle}
              title="适应屏幕"
              onClick={handleZoomReset}
              onMouseEnter={(e) => handleBtnHover(e, true)}
              onMouseLeave={(e) => handleBtnHover(e, false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                <path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {renderView()}
      </div>
    </div>
  );
}
