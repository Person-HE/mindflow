import { FiZap, FiArrowRight } from 'react-icons/fi';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">
          <FiZap />
        </div>
        
        <h1 className="welcome-title">
          <span className="gradient-text">MindFlow</span>
        </h1>
        
        <p className="welcome-subtitle">
          AI 驱动的个人思维可视化工具
        </p>
        
        <p className="welcome-description">
          输入零散的关键词或混乱的文字，AI 将自动为你生成清晰、多维、可层层下钻的可视化结构。
          通过「语言指令」与「手动编辑」的混合模式，轻松理清复杂事物的结构、关系与构成。
        </p>
        
        <div className="welcome-features">
          <div className="feature-item">
            <span className="feature-icon">◆</span>
            <span className="feature-text">6 种可视化视图</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">◆</span>
            <span className="feature-text">AI 智能解析</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">◆</span>
            <span className="feature-text">混合编辑模式</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">◆</span>
            <span className="feature-text">实时数据同步</span>
          </div>
        </div>
        
        <button className="start-btn" onClick={onStart}>
          <span>开始使用</span>
          <FiArrowRight />
        </button>
        
        <p className="welcome-hint">
          纯本地存储，完全私密
        </p>
      </div>
      
      <style>{`
        .welcome-screen {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: 
            radial-gradient(circle at 30% 40%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);
        }
        
        .welcome-content {
          max-width: 600px;
          text-align: center;
          padding: 40px;
          animation: fadeIn 0.8s ease-out;
        }
        
        .welcome-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          border-radius: 50%;
          font-size: 36px;
          color: white;
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.4);
        }
        
        .welcome-title {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -1px;
        }
        
        .welcome-subtitle {
          font-size: 20px;
          color: var(--color-text-secondary);
          margin-bottom: 24px;
          font-weight: 500;
        }
        
        .welcome-description {
          font-size: 16px;
          color: var(--color-text-muted);
          line-height: 1.8;
          margin-bottom: 32px;
        }
        
        .welcome-features {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-bottom: 40px;
        }
        
        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: rgba(15, 15, 35, 0.6);
          backdrop-filter: blur(12px);
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border-light);
        }
        
        .feature-icon {
          color: var(--color-primary-light);
          font-size: 10px;
        }
        
        .feature-text {
          font-size: 14px;
          color: var(--color-text-primary);
          font-weight: 500;
        }
        
        .start-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 40px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          border-radius: var(--radius-xl);
          color: white;
          font-size: 18px;
          font-weight: 600;
          transition: all var(--transition-fast);
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }
        
        .start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(99, 102, 241, 0.5);
        }
        
        .welcome-hint {
          margin-top: 24px;
          font-size: 13px;
          color: var(--color-text-muted);
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
