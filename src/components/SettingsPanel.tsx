import { useState } from 'react';
import { useMindFlowStore } from '../store/useMindFlowStore';
import { AIService } from '../services/aiService';
import type { AIConfig } from '../types';
import { FiX, FiWifi, FiCheck, FiAlertCircle } from 'react-icons/fi';

const providerDefaults: Record<string, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-3.5-turbo' },
  custom: { baseUrl: 'https://apihub.agnes-ai.com/v1', model: 'agnes-2.0-flash' },
};

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const aiConfig = useMindFlowStore((s) => s.aiConfig);
  const setAIConfig = useMindFlowStore((s) => s.setAIConfig);

  const [provider, setProvider] = useState<AIConfig['provider']>(aiConfig.provider);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [model, setModel] = useState(aiConfig.model);
  const [temperature, setTemperature] = useState(aiConfig.temperature);
  const [maxTokens, setMaxTokens] = useState(aiConfig.maxTokens);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleProviderChange = (p: AIConfig['provider']) => {
    setProvider(p);
    const defaults = providerDefaults[p];
    setBaseUrl(defaults.baseUrl);
    setModel(defaults.model);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const service = AIService.getInstance({
        provider,
        apiKey,
        baseUrl,
        model,
        temperature,
        maxTokens,
      });
      const result = await service.testConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: `测试失败: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setAIConfig({ provider, apiKey, baseUrl, model, temperature, maxTokens });
    onClose();
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
    width: 520,
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
    marginTop: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const radioGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  };

  const radioItemStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: `1.5px solid ${active ? '#6c63ff' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(108, 99, 255, 0.12)' : 'rgba(255,255,255,0.03)',
    color: active ? '#a9a3ff' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s',
  });

  const sliderTrackStyle: React.CSSProperties = {
    width: '100%',
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.1)',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer',
  };

  const btnBase: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: 'linear-gradient(135deg, #6c63ff, #5a4fff)',
    color: '#fff',
  };

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(255,255,255,0.08)',
    color: '#e0e0e0',
    border: '1px solid rgba(255,255,255,0.12)',
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'not-allowed',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.08)',
  };

  const resultBoxStyle = (success: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    background: success ? 'rgba(76, 175, 80, 0.12)' : 'rgba(244, 67, 54, 0.12)',
    color: success ? '#81c784' : '#ef9a9a',
    border: `1px solid ${success ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)'}`,
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtnStyle} onClick={onClose}>
          <FiX />
        </button>

        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
          AI 模型配置
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          配置用于思维导图生成的 AI 模型参数
        </p>

        <label style={labelStyle}>服务提供商</label>
        <div style={radioGroupStyle}>
          {(['ollama', 'openai', 'custom'] as const).map((p) => (
            <div
              key={p}
              style={radioItemStyle(provider === p)}
              onClick={() => handleProviderChange(p)}
            >
              {p === 'ollama' ? 'Ollama' : p === 'openai' ? 'OpenAI' : 'OpenAI兼容'}
            </div>
          ))}
        </div>

        {provider !== 'ollama' && (
          <>
            <label style={labelStyle}>API Key</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </>
        )}

        <label style={labelStyle}>Base URL</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="http://localhost:11434"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />

        <label style={labelStyle}>模型名称</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="llama3.2"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label style={labelStyle}>Temperature: {temperature.toFixed(2)}</label>
        </div>
        <input
          style={sliderTrackStyle}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />

        <label style={labelStyle}>最大 Token 数</label>
        <input
          style={inputStyle}
          type="number"
          placeholder="4096"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
        />

        <div style={{ marginTop: 20 }}>
          <button
            style={testing ? btnDisabled : btnSecondary}
            onClick={handleTest}
            disabled={testing}
          >
            <FiWifi size={15} />
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div style={resultBoxStyle(testResult.success)}>
            {testResult.success ? <FiCheck size={16} /> : <FiAlertCircle size={16} />}
            {testResult.message}
          </div>
        )}

        <div style={footerStyle}>
          <button style={btnSecondary} onClick={onClose}>
            取消
          </button>
          <button style={btnPrimary} onClick={handleSave}>
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
