import { useState } from 'react';
import { useMindFlowStore } from '../store/useMindFlowStore';
import type { ExportOptions } from '../types';
import { FiX, FiFileText, FiCode, FiImage, FiFile } from 'react-icons/fi';

interface FormatOption {
  key: ExportOptions['format'];
  label: string;
  icon: React.ReactNode;
  desc: string;
  disabled?: boolean;
  badge?: string;
}

const formats: FormatOption[] = [
  { key: 'json', label: 'JSON', icon: <FiCode size={20} />, desc: '结构化数据，便于导入其他工具' },
  { key: 'markdown', label: 'Markdown', icon: <FiFileText size={20} />, desc: '通用文本格式，兼容性最佳' },
  { key: 'pdf', label: 'PDF', icon: <FiFile size={20} />, desc: '高质量文档，适合打印分享', disabled: true, badge: '即将推出' },
  { key: 'png', label: 'PNG', icon: <FiImage size={20} />, desc: '图片快照，方便演示展示', disabled: true, badge: '即将推出' },
];

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const exportProject = useMindFlowStore((s) => s.exportProject);
  const currentProject = useMindFlowStore((s) => s.currentProject);
  const showToast = useMindFlowStore((s) => s.showToast);

  const [format, setFormat] = useState<ExportOptions['format']>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!currentProject) {
      showToast('请先打开一个项目');
      return;
    }
    setExporting(true);
    try {
      exportProject({ format, includeMetadata, quality: 'high' });
      onClose();
    } catch {
      showToast('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    position: 'relative',
    width: 460,
    maxHeight: '85vh',
    overflowY: 'auto',
    background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    padding: '32px 28px',
    color: '#e0e0e0',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: 20,
    padding: 4,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const cardStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    borderRadius: 12,
    border: `1.5px solid ${active && !disabled ? '#6c63ff' : 'rgba(255,255,255,0.1)'}`,
    background: active && !disabled ? 'rgba(108, 99, 255, 0.1)' : 'rgba(255,255,255,0.03)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.2s',
    marginBottom: 10,
  });

  const iconBoxStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active && !disabled ? 'rgba(108, 99, 255, 0.2)' : 'rgba(255,255,255,0.06)',
    color: active && !disabled ? '#a9a3ff' : 'rgba(255,255,255,0.45)',
    flexShrink: 0,
  });

  const checkboxStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '1.5px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.06)',
    accentColor: '#6c63ff',
    cursor: 'pointer',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '11px 24px',
    borderRadius: 10,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: exporting ? 'not-allowed' : 'pointer',
    background: 'linear-gradient(135deg, #6c63ff, #5a4fff)',
    color: '#fff',
    opacity: exporting ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '11px 24px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.08)',
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 500,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtnStyle} onClick={onClose}>
          <FiX />
        </button>

        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
          导出项目
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          {currentProject ? currentProject.name : '将项目数据导出为指定格式'}
        </p>

        <div style={{ marginTop: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            选择导出格式
          </span>

          <div style={{ marginTop: 10 }}>
            {formats.map((f) => (
              <div
                key={f.key}
                style={cardStyle(format === f.key, !!f.disabled)}
                onClick={() => !f.disabled && setFormat(f.key)}
              >
                <div style={iconBoxStyle(format === f.key, !!f.disabled)}>
                  {f.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: f.disabled ? 'rgba(255,255,255,0.35)' : '#fff' }}>
                      {f.label}
                    </span>
                    {f.badge && <span style={badgeStyle}>{f.badge}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {f.desc}
                  </div>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${format === f.key && !f.disabled ? '#6c63ff' : 'rgba(255,255,255,0.2)'}`,
                    background: format === f.key && !f.disabled ? '#6c63ff' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                >
                  {format === f.key && !f.disabled && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="includeMetadata"
            style={checkboxStyle}
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
          />
          <label
            htmlFor="includeMetadata"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', userSelect: 'none' }}
          >
            包含元数据（创建时间、标签、重要度等）
          </label>
        </div>

        <div style={footerStyle}>
          <button style={btnSecondary} onClick={onClose}>
            取消
          </button>
          <button
            style={btnPrimary}
            onClick={handleExport}
            disabled={exporting || !currentProject}
          >
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
