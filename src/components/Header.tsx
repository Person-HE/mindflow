import { useMindFlowStore } from '../store/useMindFlowStore';
import { FiSave, FiDownload, FiSettings, FiZap } from 'react-icons/fi';

export default function Header() {
  const { currentProject, saveProject, setShowExportDialog, setShowSettings, toastMessage } = useMindFlowStore();

  return (
    <header style={{
      position: 'relative',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '56px',
      background: 'rgba(15, 15, 35, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border-light)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiZap style={{
            fontSize: '24px',
            color: 'var(--color-primary-light)',
            filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))'
          }} />
          <span style={{
            fontSize: '20px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px'
          }}>MindFlow</span>
        </div>
        {currentProject && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: 'var(--color-bg-hover)',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px'
          }}>
            <span style={{ color: 'var(--color-text-muted)' }}>项目：</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{currentProject.name}</span>
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            background: 'var(--color-success)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--color-success)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
          <span style={{
            fontSize: '13px',
            color: 'var(--color-success)',
            fontWeight: 500
          }}>AI 引擎就绪</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => saveProject()}
          title="保存项目"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            transition: 'all var(--transition-fast)',
            fontSize: '18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)';
            e.currentTarget.style.color = 'var(--color-primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <FiSave />
        </button>
        <button
          onClick={() => setShowExportDialog(true)}
          title="导出"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            transition: 'all var(--transition-fast)',
            fontSize: '18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)';
            e.currentTarget.style.color = 'var(--color-primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <FiDownload />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="设置"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            transition: 'all var(--transition-fast)',
            fontSize: '18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)';
            e.currentTarget.style.color = 'var(--color-primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <FiSettings />
        </button>
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: 'var(--color-success)',
          color: '#fff',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          animation: 'fadeInOut 2s ease-in-out'
        }}>
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          20% { opacity: 1; transform: translateX(-50%) translateY(0); }
          80% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </header>
  );
}