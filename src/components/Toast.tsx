import { useMindFlowStore } from '../store/useMindFlowStore';
import { FiCheck, FiInfo } from 'react-icons/fi';

export default function Toast() {
  const { toastMessage, clearToast } = useMindFlowStore();

  if (!toastMessage) return null;

  const isError = toastMessage.includes('错误') || toastMessage.includes('失败') || toastMessage.includes('error');

  return (
    <>
      <style>{`
        @keyframes toastFadeIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
      <div
        onClick={clearToast}
        style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          background: isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(15, 15, 35, 0.95)',
          backdropFilter: 'blur(12px)',
          border: isError ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border-light)',
          color: isError ? '#fca5a5' : 'var(--color-text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 9999,
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'toastFadeIn 0.25s ease-out',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {isError ? (
          <FiInfo style={{ fontSize: '16px', flexShrink: 0 }} />
        ) : (
          <FiCheck style={{ fontSize: '16px', color: '#34d399', flexShrink: 0 }} />
        )}
        <span>{toastMessage}</span>
      </div>
    </>
  );
}
