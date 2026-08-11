import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  X, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  ChevronDown,
  Brain,
  MessageSquare,
  Zap
} from 'lucide-react';
import { 
  checkOllamaStatus, 
  sendChatMessageStream, 
  buildSystemContext 
} from '../services/localLLMService';

export function LocalAIAssistant({ tasks = [], habits = [], notes = [], user = null }) {
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
      content: 'E aí! Estou por aqui para te ajudar a destrinchar o seu dia. Como posso te ajudar agora, seja com as tarefas, ideias ou conselhos?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingText, setActiveStreamingText] = useState('');
  
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Check Ollama status on mount and when opening
  const verifyOllama = async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    const result = await checkOllamaStatus();
    setOllamaStatus({
      online: result.online,
      models: result.models,
      checking: false,
      error: result.error
    });

    if (result.models.length > 0 && !selectedModel) {
      // Pick first model or preferred llama3.2 / qwen2.5
      const preferred = result.models.find(m => m.includes('llama3') || m.includes('qwen')) || result.models[0];
      setSelectedModel(preferred);
    }
  };

  useEffect(() => {
    verifyOllama();
  }, []);

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

    // Prepare system context with latest tasks/habits/notes
    const systemContext = buildSystemContext({ tasks, habits, notes, user });
    
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-stone-900 text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:bg-stone-800 transition-all transform hover:scale-105 active:scale-95 group border border-stone-700/50 cursor-pointer"
          title="Abrir Assistente de IA Local"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${ollamaStatus.online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="font-medium text-sm text-stone-100 pr-1">Assistente IA</span>
        </button>
      )}

      {/* Main Chat Panel */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-50 bg-white dark:bg-stone-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-stone-200/80 dark:border-stone-800 flex flex-col overflow-hidden transition-all duration-300 ${
            isMinimized 
              ? 'w-80 h-16' 
              : 'w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 px-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-stone-800 rounded-lg text-amber-400 border border-stone-700">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-white">Ajudante do Dia</h3>
                </div>

                {/* Model Selector / Status subtitle */}
                {!isMinimized && (
                  ollamaStatus.online && ollamaStatus.models.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-1">
                      <span className="text-[11px] font-medium text-stone-400">Modelo:</span>
                      <div className="relative inline-flex items-center">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="appearance-none bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium pl-2.5 pr-6 py-0.5 rounded-md border border-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer transition shadow-xs"
                        >
                          {ollamaStatus.models.map(m => (
                            <option key={m} value={m} className="bg-stone-900 text-stone-200 py-1">
                              {m}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-stone-400 absolute right-1.5 pointer-events-none" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {ollamaStatus.checking ? 'Verificando conexão...' : 'Servidor não detectado'}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={verifyOllama}
                className="p-1.5 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition"
                title="Recarregar conexão Ollama"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${ollamaStatus.checking ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={handleClearHistory}
                className="p-1.5 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition"
                title="Limpar histórico de mensagens"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <ChevronDown className={`w-4 h-4 transform transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition"
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
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Ollama não encontrado em localhost:11434</p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      Abra o terminal e execute: <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">ollama serve</code>
                    </p>
                  </div>
                </div>
              )}

              {/* Chat Message List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50/50 dark:bg-stone-900/50">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-stone-900 text-white rounded-br-xs shadow-sm'
                          : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/70 text-stone-800 dark:text-stone-100 rounded-bl-xs shadow-sm'
                      }`}
                    >
                      {/* Render markdown line breaks */}
                      <div className="whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                      <span 
                        className={`text-[9px] mt-1 block text-right ${
                          msg.role === 'user' ? 'text-stone-400' : 'text-stone-400 dark:text-stone-500'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Streaming Assistant Response */}
                {isGenerating && activeStreamingText && (
                  <div className="flex flex-col items-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-xs px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/70 text-stone-800 dark:text-stone-100 shadow-sm whitespace-pre-wrap font-sans">
                      {activeStreamingText}
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-amber-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Loading indicator prior to first streamed chunk */}
                {isGenerating && !activeStreamingText && (
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 p-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Pensando com a LLM local...</span>
                    <button 
                      onClick={handleStopGeneration}
                      className="ml-auto text-[10px] text-red-500 underline hover:text-red-600"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="px-3 py-2 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(action.prompt)}
                    disabled={isGenerating || !ollamaStatus.online}
                    className="shrink-0 text-[11px] px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-full transition disabled:opacity-50 cursor-pointer"
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
                className="p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={ollamaStatus.online ? "Pergunte ao assistente..." : "Inicie o Ollama para conversar..."}
                  disabled={isGenerating || !ollamaStatus.online}
                  className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800 dark:text-stone-100 placeholder-stone-400 disabled:opacity-60"
                />

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition"
                    title="Parar geração"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || !ollamaStatus.online}
                    className="p-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
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
