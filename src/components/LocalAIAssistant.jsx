import React, { useCallback, useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Trash2,
  ChevronDown,
  Brain,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import './LocalAIAssistant.css';
import { AIToolConfirmation } from './AIToolConfirmation';
import { 
  checkOllamaStatus, 
  sendOrganizerAgentMessageStream,
  buildSystemContext 
} from '../services/localLLMService';

const PREFERRED_LOCAL_MODEL = 'qwen3.5:4b';

const selectPreferredModel = (models) => (
  models.find(model => model === PREFERRED_LOCAL_MODEL)
  || models.find(model => model.startsWith('qwen3.5:4b'))
  || models.find(model => model.startsWith('qwen3.5'))
  || models.find(model => model.startsWith('qwen3'))
  || models.find(model => model.startsWith('llama3.2'))
  || models[0]
);

export function LocalAIAssistant({
  tasks = [],
  habits = [],
  notes = [],
  events = [],
  dailyHabitsState = null,
  user = null,
  googleCalendarConnected = false,
  onExecuteAction = null,
  onUndoAction = null,
  onAuditAction = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Connection & Model State
  const [ollamaStatus, setOllamaStatus] = useState({ online: false, models: [], checking: true });
  const [selectedModel, setSelectedModel] = useState('');
  
  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'E aí, tudo certo? O que você quer organizar hoje? Posso dar uma mão com sua agenda, tarefas ou ideias.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingText, setActiveStreamingText] = useState('');
  const hasPendingAction = messages.some(message => (
    message.kind === 'action-confirmation'
    && ['pending', 'confirming', 'error'].includes(message.actionStatus)
  ));
  
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Check Ollama status on mount and when opening
  const verifyOllama = useCallback(async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    const result = await checkOllamaStatus();
    setOllamaStatus({
      online: result.online,
      models: result.models,
      checking: false,
      error: result.error
    });

    if (result.models.length > 0) {
      const preferred = selectPreferredModel(result.models);
      setSelectedModel(currentModel => currentModel || preferred);
    }
  }, []);

  useEffect(() => {
    verifyOllama();
  }, [verifyOllama]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, activeStreamingText]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (customPrompt = null) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || isGenerating || hasPendingAction) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setIsGenerating(true);
    setActiveStreamingText('');

    // Prepare system context with the latest data stored in the organizer.
    const organizerData = {
      tasks,
      habits,
      notes,
      events,
      dailyHabitsState,
      user,
      googleCalendarConnected,
    };
    const systemContext = buildSystemContext({
      ...organizerData,
      toolsEnabled: true,
      writeToolsEnabled: true,
    });
    
    // Prepare conversation payload for LLM (last 10 messages max)
    const historyPayload = [...messages, userMsg]
      .filter(m => m.id !== 'welcome' && m.content && m.kind !== 'action-confirmation')
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let streamedAccumulator = '';

    try {
      const modelToUse = selectedModel || selectPreferredModel(ollamaStatus.models) || PREFERRED_LOCAL_MODEL;
      
      const agentResult = await sendOrganizerAgentMessageStream({
        messages: historyPayload,
        organizerData,
        systemContext,
        model: modelToUse,
        signal: abortController.signal,
        onChunk: (chunk, fullText) => {
          streamedAccumulator = fullText;
          setActiveStreamingText(fullText);
        }
      });

      if (agentResult.pendingAction) {
        setMessages(prev => [
          ...prev,
          {
            id: `action-${Date.now()}`,
            role: 'assistant',
            kind: 'action-confirmation',
            proposal: agentResult.pendingAction,
            actionStatus: 'pending',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
      } else {
        const finalText = streamedAccumulator.trim() || agentResult.content.trim();
        if (!finalText) return;
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: finalText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao comunicar com Ollama:', error);
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `**Erro na comunicação:** ${error.message || 'Não foi possível se conectar ao Ollama local.'}\n\nVerifique se o Ollama está rodando no terminal com \`ollama serve\`.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } finally {
      setIsGenerating(false);
      setActiveStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const updateActionMessage = (messageId, updates) => {
    setMessages(prev => prev.map(message => (
      message.id === messageId ? { ...message, ...updates } : message
    )));
  };

  const handleConfirmAction = async (messageId, proposal) => {
    if (!onExecuteAction) {
      updateActionMessage(messageId, { actionStatus: 'error', actionError: 'O executor do Organizador não está disponível.' });
      return;
    }

    updateActionMessage(messageId, { actionStatus: 'confirming', actionError: '' });
    try {
      const result = await onExecuteAction(proposal);
      if (!result?.ok) throw new Error(result?.error || 'Não foi possível executar a ação.');
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let auditResult = null;
      try {
        auditResult = await onAuditAction?.({
          toolName: proposal.toolName,
          arguments: proposal.arguments,
          confirmation: 'confirmed',
          result: 'success',
          resultMessage: result.message,
          collection: result.collection,
        });
      } catch (auditError) {
        console.error('Não foi possível registrar a auditoria da IA:', auditError);
      }
      setMessages(prev => [
        ...prev.map(message => message.id === messageId
          ? { ...message, actionStatus: 'confirmed', actionResult: result, actionError: '' }
          : message),
        {
          id: `result-${Date.now()}`,
          role: 'assistant',
          kind: 'action-result',
          content: result.message,
          timestamp,
          actionResult: result,
          originalToolName: proposal.toolName,
          auditEntryId: auditResult?.entry?.id || null,
          undoStatus: result.undoId ? 'available' : null,
        },
      ]);
    } catch (error) {
      const auditPromise = onAuditAction?.({
        toolName: proposal.toolName,
        arguments: proposal.arguments,
        confirmation: 'confirmed',
        result: 'error',
        resultMessage: error.message || 'Não foi possível executar a ação.',
      });
      auditPromise?.catch(console.error);
      updateActionMessage(messageId, {
        actionStatus: 'error',
        actionError: error.message || 'Não foi possível executar a ação.',
      });
    }
  };

  const handleCancelAction = (messageId, proposal) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [
      ...prev.map(message => message.id === messageId
        ? { ...message, actionStatus: 'cancelled', actionError: '' }
        : message),
      {
        id: `cancelled-${Date.now()}`,
        role: 'assistant',
        kind: 'action-result',
        content: 'Ação cancelada. Nenhum dado foi alterado.',
        timestamp,
      },
    ]);
    const auditPromise = onAuditAction?.({
      toolName: proposal.toolName,
      arguments: proposal.arguments,
      confirmation: 'cancelled',
      result: 'cancelled',
      resultMessage: 'Ação cancelada. Nenhum dado foi alterado.',
    });
    auditPromise?.catch(console.error);
  };

  const handleUndoAction = async (messageId, message) => {
    if (!onUndoAction || !message.actionResult?.undoId || message.undoStatus !== 'available') return;
    updateActionMessage(messageId, { undoStatus: 'undoing', undoError: '' });
    try {
      const result = await onUndoAction(message.actionResult.undoId);
      if (!result?.ok) throw new Error(result?.error || 'Não foi possível desfazer a ação.');
      updateActionMessage(messageId, {
        undoStatus: 'undone',
        undoMessage: result.message,
        undoError: '',
      });
      await onAuditAction?.({
        toolName: message.actionResult?.toolName || message.originalToolName || 'acao_desconhecida',
        arguments: {},
        confirmation: 'confirmed',
        result: 'undone',
        resultMessage: result.message,
        collection: result.collection,
        undoOf: message.auditEntryId,
      });
    } catch (error) {
      updateActionMessage(messageId, {
        undoStatus: 'available',
        undoError: error.message || 'Não foi possível desfazer a ação.',
      });
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearHistory = () => {
    if (isGenerating || hasPendingAction) return;
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Histórico limpo. Como posso ajudar agora?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Quick Action Chips (Sem emojis)
  const quickActions = [
    { label: 'Minhas Prioridades de Hoje', prompt: 'Com base nas minhas tarefas pendentes e hábitos, quais devem ser minhas 3 principais prioridades para hoje?' },
    { label: 'Resumo das Tarefas', prompt: 'Resuma rapidamente quantas tarefas pendentes eu tenho e quais são as mais urgentes.' },
    { label: 'Dica de Produtividade', prompt: 'Me dê uma dica rápida de produtividade adaptada para a minha lista atual de hábitos e tarefas.' }
  ];

  return (
    <>
      {/* Floating Toggle Button (Trigger) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
            verifyOllama();
          }}
          className="local-ai-toggle"
          title="Abrir Ajudante do Dia"
        >
          <span className="local-ai-toggle-bracket">[</span>
          <div className="local-ai-toggle-mark">
            <Sparkles className="w-4 h-4" />
            <span className={`local-ai-status-dot ${ollamaStatus.online ? 'is-online' : 'is-offline'}`} />
          </div>
          <span className="local-ai-toggle-label">IA</span>
          <span className="local-ai-toggle-bracket">]</span>
        </button>
      )}

      {/* Main Chat Panel */}
      {isOpen && (
        <div 
          className={`local-ai-panel ${isMinimized ? 'is-minimized' : ''}`}
        >
          {/* Header */}
          <div className="local-ai-header">
            <div className="local-ai-brand">
              <div className="local-ai-mark">
                <span>[</span>
                <Brain className="w-4 h-4" />
                <span>]</span>
              </div>
              <div className="local-ai-brand-copy">
                <h3>Ajudante do Dia</h3>

                {/* Model Selector / Status subtitle */}
                {!isMinimized && (
                  ollamaStatus.online && ollamaStatus.models.length > 0 ? (
                    <div className="local-ai-model-row">
                      <span>Modelo</span>
                      <div className="local-ai-select-wrap">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="local-ai-model-select"
                        >
                          {ollamaStatus.models.map(m => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </div>
                  ) : (
                    <p className="local-ai-status-text">
                      {ollamaStatus.checking ? 'Verificando conexão...' : 'Servidor não detectado'}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="local-ai-controls">
              <button 
                onClick={verifyOllama}
                className="local-ai-icon-button"
                title="Recarregar conexão Ollama"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${ollamaStatus.checking ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={handleClearHistory}
                className="local-ai-icon-button"
                title="Limpar histórico de mensagens"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsMinimized(!isMinimized)}
                className="local-ai-icon-button"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <ChevronDown className={`w-4 h-4 transform transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="local-ai-icon-button"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Ollama Offline Banner */}
              {!ollamaStatus.online && !ollamaStatus.checking && (
                <div className="local-ai-offline">
                  <AlertCircle className="w-4 h-4" />
                  <div>
                    <p>{ollamaStatus.error || 'Ollama não encontrado em localhost:11434'}</p>
                    <p>
                      Abra o terminal e execute: <code>ollama serve</code>
                    </p>
                  </div>
                </div>
              )}

              {/* Chat Message List */}
              <div className="local-ai-messages">
                {messages.map((msg) => msg.kind === 'action-confirmation' ? (
                  <div key={msg.id} className="local-ai-message-row is-assistant is-action">
                    <AIToolConfirmation
                      proposal={msg.proposal}
                      status={msg.actionStatus}
                      error={msg.actionError}
                      onConfirm={() => handleConfirmAction(msg.id, msg.proposal)}
                      onCancel={() => handleCancelAction(msg.id, msg.proposal)}
                    />
                  </div>
                ) : (
                  <div 
                    key={msg.id}
                    className={`local-ai-message-row ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                  >
                    <div 
                      className={`local-ai-message ${msg.role === 'user' ? 'is-user' : 'is-assistant'} ${msg.kind === 'action-result' ? 'is-action-result' : ''}`}
                    >
                      <div className="local-ai-message-content">
                        {msg.content}
                      </div>
                      {msg.kind === 'action-result' && msg.undoStatus && (
                        <div className="ai-action-result-controls">
                          {msg.undoStatus === 'available' && (
                            <button type="button" onClick={() => handleUndoAction(msg.id, msg)}>
                              <RotateCcw className="w-3.5 h-3.5" />
                              Desfazer
                            </button>
                          )}
                          {msg.undoStatus === 'undoing' && (
                            <span><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Desfazendo</span>
                          )}
                          {msg.undoStatus === 'undone' && (
                            <span><CheckCircle2 className="w-3.5 h-3.5" /> {msg.undoMessage || 'Ação desfeita'}</span>
                          )}
                          {msg.undoError && <small role="alert">{msg.undoError}</small>}
                        </div>
                      )}
                      <span className="local-ai-message-time">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}

                {/* Streaming Assistant Response */}
                {isGenerating && activeStreamingText && (
                  <div className="local-ai-message-row is-assistant">
                    <div className="local-ai-message is-assistant is-streaming">
                      {activeStreamingText}
                      <span className="local-ai-caret" />
                    </div>
                  </div>
                )}

                {/* Loading indicator prior to first streamed chunk */}
                {isGenerating && !activeStreamingText && (
                  <div className="local-ai-thinking">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Pensando com a LLM local...</span>
                    <button 
                      onClick={handleStopGeneration}
                      className="local-ai-cancel"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="local-ai-quick-actions">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(action.prompt)}
                    disabled={isGenerating || hasPendingAction || !ollamaStatus.online}
                    className="local-ai-chip"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="local-ai-compose"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={hasPendingAction ? 'Confirme ou cancele a ação acima...' : ollamaStatus.online ? "Pergunte ao Ajudante do Dia..." : "Inicie o Ollama para conversar..."}
                  disabled={isGenerating || hasPendingAction || !ollamaStatus.online}
                  className="local-ai-input"
                />

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="local-ai-send-button is-stop"
                    title="Parar geração"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || hasPendingAction || !ollamaStatus.online}
                    className="local-ai-send-button"
                    title="Enviar mensagem"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
