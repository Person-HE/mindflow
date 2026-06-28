import { useState, useRef, useEffect } from 'react';
import type { AIMessage } from '../types';
import { FiSend, FiMessageSquare, FiFileText, FiLoader } from 'react-icons/fi';

interface ChatPanelProps {
  messages: AIMessage[];
  isProcessing: boolean;
  inputMode: 'chat' | 'bulk';
  onInputChange: (mode: 'chat' | 'bulk') => void;
  onSendMessage: (content: string) => void;
}

const suggestions = [
  '产品设计 用户体验 界面设计',
  '项目管理 任务分配 进度跟踪',
  '前端开发 React 组件库 状态管理',
];

export default function ChatPanel({
  messages,
  isProcessing,
  inputMode,
  onInputChange,
  onSendMessage,
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || isProcessing) return;
    onSendMessage(text);
    setChatInput('');
  };

  const handleBulkSend = () => {
    const text = bulkInput.trim();
    if (!text || isProcessing) return;
    onSendMessage(text);
    setBulkInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBulkSend();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'rgba(15, 15, 35, 0.95)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary, #e0e0e0)',
    overflow: 'hidden',
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    flexShrink: 0,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 0',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--color-primary, #6c63ff)' : 'var(--color-text-secondary, #888)',
    background: active ? 'rgba(108, 99, 255, 0.08)' : 'transparent',
    border: 'none',
    borderBottom: active
      ? '2px solid var(--color-primary, #6c63ff)'
      : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const emptyStateStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: '24px 16px',
    color: 'var(--color-text-secondary, #888)',
  };

  const suggestionChipStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 13,
    borderRadius: 20,
    border: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    background: 'var(--color-bg-card, rgba(255,255,255,0.04))',
    color: 'var(--color-text-secondary, #888)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  };

  const messageRowStyle = (isUser: boolean): React.CSSProperties => ({
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
    gap: 8,
  });

  const avatarStyle = (isUser: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    background: isUser
      ? 'var(--color-primary, #6c63ff)'
      : 'var(--color-bg-card, rgba(255,255,255,0.06))',
    color: '#fff',
    order: isUser ? 1 : 0,
  });

  const bubbleStyle = (isUser: boolean): React.CSSProperties => ({
    maxWidth: '80%',
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 1.6,
    borderRadius: 12,
    background: isUser
      ? 'var(--color-primary, #6c63ff)'
      : 'var(--color-bg-card, rgba(255,255,255,0.06))',
    border: isUser
      ? 'none'
      : '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    color: isUser ? '#fff' : 'var(--color-text-primary, #e0e0e0)',
    wordBreak: 'break-word',
    order: isUser ? 0 : 1,
  });

  const inputAreaStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderTop: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    flexShrink: 0,
  };

  const chatInputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  };

  const chatInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 14px',
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    background: 'var(--color-bg-card, rgba(255,255,255,0.04))',
    color: 'var(--color-text-primary, #e0e0e0)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  };

  const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    border: 'none',
    background: disabled
      ? 'rgba(108, 99, 255, 0.3)'
      : 'var(--color-primary, #6c63ff)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s',
  });

  const bulkTextareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 140,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.6,
    borderRadius: 8,
    border: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
    background: 'var(--color-bg-card, rgba(255,255,255,0.04))',
    color: 'var(--color-text-primary, #e0e0e0)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    resize: 'vertical',
  };

  const bulkFooterStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  };

  const charCountStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-secondary, #888)',
  };

  const bulkSendBtnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    background: disabled
      ? 'rgba(108, 99, 255, 0.3)'
      : 'var(--color-primary, #6c63ff)',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s',
  });

  const typingDot = (delay: number): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--color-text-secondary, #888)',
    animation: 'chatTypingBounce 1.4s infinite ease-in-out',
    animationDelay: `${delay}s`,
  });

  const renderEmptyState = () => (
    <div style={emptyStateStyle}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(108, 99, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FiMessageSquare size={22} color="var(--color-primary, #6c63ff)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>
        描述你想要的思维导图
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary, #888)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        输入主题关键词或详细描述，AI 将为你生成结构化的思维导图
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {suggestions.map((s) => (
          <div
            key={s}
            style={suggestionChipStyle}
            onClick={() => onSendMessage(s)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary, #6c63ff)';
              e.currentTarget.style.color = 'var(--color-primary, #6c63ff)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-light, rgba(255,255,255,0.08))';
              e.currentTarget.style.color = 'var(--color-text-secondary, #888)';
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );

  const renderMessages = () => (
    <div style={messagesContainerStyle}>
      {messages.map((msg, i) => (
        <div key={i} style={messageRowStyle(msg.role === 'user')}>
          <div style={avatarStyle(msg.role === 'user')}>
            {msg.role === 'user' ? 'U' : 'AI'}
          </div>
          <div style={bubbleStyle(msg.role === 'user')}>{msg.content}</div>
        </div>
      ))}
      {isProcessing && messages.length > 0 && (
        <div style={messageRowStyle(false)}>
          <div style={avatarStyle(false)}>AI</div>
          <div style={bubbleStyle(false)}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
              <span style={typingDot(0)} />
              <span style={typingDot(0.2)} />
              <span style={typingDot(0.4)} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const renderChatInput = () => (
    <div style={inputAreaStyle}>
      <style>{`
        @keyframes chatTypingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
      <div style={chatInputWrapperStyle}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleChatKeyDown}
          placeholder="描述你想要的思维导图..."
          style={chatInputStyle}
          disabled={isProcessing}
        />
        <button
          style={sendBtnStyle(!chatInput.trim() || isProcessing)}
          onClick={handleSend}
          disabled={!chatInput.trim() || isProcessing}
        >
          {isProcessing ? <FiLoader size={16} className="spin-icon" /> : <FiSend size={16} />}
        </button>
      </div>
    </div>
  );

  const renderBulkInput = () => (
    <div style={inputAreaStyle}>
      <textarea
        ref={textareaRef}
        value={bulkInput}
        onChange={(e) => setBulkInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="粘贴或输入大量文本内容，AI 将自动解析并生成思维导图结构..."
        style={bulkTextareaStyle}
        disabled={isProcessing}
      />
      <div style={bulkFooterStyle}>
        <span style={charCountStyle}>{bulkInput.length} 字符</span>
        <button
          style={bulkSendBtnStyle(!bulkInput.trim() || isProcessing)}
          onClick={handleBulkSend}
          disabled={!bulkInput.trim() || isProcessing}
        >
          {isProcessing ? (
            <>
              <FiLoader size={14} className="spin-icon" />
              解析中...
            </>
          ) : (
            <>
              <FiFileText size={14} />
              开始解析
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={tabBarStyle}>
        <button
          style={tabStyle(inputMode === 'chat')}
          onClick={() => onInputChange('chat')}
        >
          <FiMessageSquare size={14} />
          对话模式
        </button>
        <button
          style={tabStyle(inputMode === 'bulk')}
          onClick={() => onInputChange('bulk')}
        >
          <FiFileText size={14} />
          批量输入
        </button>
      </div>

      {messages.length === 0
        ? renderEmptyState()
        : renderMessages()}

      {inputMode === 'chat' ? renderChatInput() : renderBulkInput()}
    </div>
  );
}
