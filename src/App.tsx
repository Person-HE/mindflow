import { useState, useEffect } from 'react';
import { useMindFlowStore } from './store/useMindFlowStore';
import { AIService } from './services/aiService';
import type { AIMessage, AIParsedResult } from './types';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import VisualizationArea from './components/VisualizationArea';
import SettingsPanel from './components/SettingsPanel';
import ExportDialog from './components/ExportDialog';
import NodeDetailPanel from './components/NodeDetailPanel';
import Toast from './components/Toast';
import './App.css';

function App() {
  const {
    currentProject,
    chatMessages,
    isProcessing,
    activeView,
    showSettings,
    showExportDialog,
    showNodeDetail,
    selectedNodeId,
    aiConfig,
    addChatMessage,
    setIsProcessing,
    processAIResponse,
    createNewProject,
    setShowSettings,
    setShowExportDialog,
    setShowNodeDetail,
    showToast,
  } = useMindFlowStore();

  const [aiService] = useState(() => AIService.getInstance(aiConfig));
  const [inputMode, setInputMode] = useState<'chat' | 'bulk'>('chat');

  useEffect(() => {
    aiService.updateConfig(aiConfig);
  }, [aiConfig, aiService]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isProcessing) return;

    const userMessage: AIMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
      type: inputMode === 'chat' ? 'text' : 'command',
    };
    addChatMessage(userMessage);
    setIsProcessing(true);

    try {
      if (!currentProject) {
        createNewProject('新思维导图');
      }

      const state = useMindFlowStore.getState();
      const project = state.currentProject!;

      let result: AIParsedResult;
      const isCommand = content.startsWith('/') ||
        content.includes('添加') || content.includes('删除') ||
        content.includes('连接') || content.includes('分组') ||
        content.includes('修改') || content.includes('重命名');

      if (isCommand && project.nodes.length > 0) {
        result = await aiService.processCommand(content, project.nodes, project.edges);
      } else {
        result = await aiService.parseText(content);
      }

      processAIResponse(result);

      const assistantMessage: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.warnings.length > 0
          ? `已处理完成。${result.warnings.join('。')}`
          : `已生成 ${result.nodes.length} 个节点和 ${result.edges.length} 条关系。推荐使用${getViewName(result.recommendedView)}查看。`,
        timestamp: Date.now(),
        type: 'suggestion',
      };
      addChatMessage(assistantMessage);

      if (result.warnings.length > 0) {
        showToast(result.warnings[0]);
      }
    } catch (error: any) {
      console.error('AI error:', error);
      const errorMessage: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `处理失败：${error.message || '未知错误'}。请检查AI配置是否正确。`,
        timestamp: Date.now(),
        type: 'text',
      };
      addChatMessage(errorMessage);
      showToast('AI处理失败，请检查配置');
    } finally {
      setIsProcessing(false);
    }
  };

  const getViewName = (view: string): string => {
    const names: Record<string, string> = {
      tree: '层级树状图',
      network: '网络关系图',
      kanban: '结构化看板',
      knowledge: '增强知识图谱',
      architecture: '架构图',
      breakdown: '极致拆解视图',
    };
    return names[view] || view;
  };

  return (
    <div className="app-container">
      <div className="background-effects">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        <div className="grid-pattern"></div>
      </div>

      <Header />

      <main className="main-content">
        <Sidebar />
        <div className="content-area">
          <ChatPanel
            messages={chatMessages}
            isProcessing={isProcessing}
            inputMode={inputMode}
            onInputChange={setInputMode}
            onSendMessage={handleSendMessage}
          />
          <VisualizationArea activeView={activeView} />
        </div>
      </main>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}
      {showNodeDetail && selectedNodeId && (
        <NodeDetailPanel nodeId={selectedNodeId} onClose={() => setShowNodeDetail(false)} />
      )}
      <Toast />
    </div>
  );
}

export default App;
