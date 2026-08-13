import React, { useCallback, useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Trash2,
  ChevronDown,
  Brain
} from 'lucide-react';
import './LocalAIAssistant.css';
import { 
  checkOllamaStatus, 
  sendChatMessageStream, 
  buildSystemContext 
} from '../services/localLLMService';

export function LocalAIAssistant({ tasks = [], habits = [], notes = [], events = [], user = null }) {
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
      const preferred = result.models.find(m => m.includes('llama3') || m.includes('qwen')) || result.models[0];
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
    if (!textToSend.trim() || isGenerating) return;

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
    const systemContext = buildSystemContext({ tasks, habits, notes, events, user });
    
    // Prepare conversation payload for LLM (last 10 messages max)
    const historyPayload = [...messages, userMsg]
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let streamedAccumulator = '';

    try {
      const modelToUse = selectedModel || (ollamaStatus.models[0] || 'llama3.2');
      
      await sendChatMessageStream({
        messages: historyPayload,
        systemContext,
        model: modelToUse,
        signal: abortController.signal,
        onChunk: (chunk, fullText) => {
          streamedAccumulator = fullText;
          setActiveStreamingText(fullText);
        }
      });

      // Streaming finished
      if (streamedAccumulator.trim()) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: streamedAccumulator.trim(),
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearHistory = () => {
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
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`local-ai-message-row ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                  >
                    <div 
                      className={`local-ai-message ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                    >
                      {/* Render markdown line breaks */}
                      <div className="local-ai-message-content">
                        {msg.content}
                      </div>
                      <span 
                        className="local-ai-message-time"
                      >
                        {msg.timestamp}
                      </span>
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
                    disabled={isGenerating || !ollamaStatus.online}
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
                  placeholder={ollamaStatus.online ? "Pergunte ao Ajudante do Dia..." : "Inicie o Ollama para conversar..."}
                  disabled={isGenerating || !ollamaStatus.online}
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
                    disabled={!inputMessage.trim() || !ollamaStatus.online}
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
