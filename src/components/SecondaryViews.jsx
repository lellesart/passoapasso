import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  addDoc,
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from '../firebase/config';

export function GoogleCalendarSyncView({ googleAccessToken, handleLogin, handleLogout }) {
  return (
    <div className="google-sync-view">
      <header className="google-sync-hero">
        <div className="google-sync-hero-copy">
          <span className="google-sync-kicker">Integração externa · 04</span>
          <h1>Google Calendar</h1>
          <p>
            Envie os eventos criados no Organizador para sua agenda principal do Google e mantenha os lembretes no mesmo lugar.
          </p>
        </div>
        <div className={`google-sync-stamp ${googleAccessToken ? 'is-connected' : ''}`}>
          <CalendarIcon className="w-5 h-5" />
          <div>
            <span>Status atual</span>
            <strong>{googleAccessToken ? 'Conectado' : 'Desconectado'}</strong>
          </div>
          <i aria-hidden="true"></i>
        </div>
      </header>

      <div className="google-sync-layout">
        <section className="google-sync-document" aria-labelledby="google-sync-status-title">
          <div className="google-sync-document-header">
            <Settings className="w-4 h-4" />
            <div>
              <span className="google-sync-kicker">Estado da integração</span>
              <h2 id="google-sync-status-title">Status da conexão</h2>
            </div>
          </div>

          <div className={`google-sync-connection ${googleAccessToken ? 'is-connected' : ''}`}>
            <span className="google-sync-connection-dot" aria-hidden="true"></span>
            <div>
              <strong>{googleAccessToken ? 'Conectado ao Google Calendar' : 'Conta ainda não vinculada'}</strong>
              <p>
                {googleAccessToken
                  ? 'Ao criar um evento, mantenha a opção de sincronização selecionada para enviá-lo à sua agenda principal.'
                  : 'Vincule sua conta para habilitar o envio dos eventos criados no Organizador.'}
              </p>
            </div>
          </div>

          <div className="google-sync-action-row">
            {!googleAccessToken ? (
              <button onClick={handleLogin} className="google-sync-primary-action">
                <CalendarIcon className="w-4 h-4" />
                <span>Vincular conta Google</span>
              </button>
            ) : (
              <button onClick={handleLogout} className="google-sync-secondary-action">
                <span>Desvincular e sair</span>
              </button>
            )}
            <span className="google-sync-action-note">
              {googleAccessToken ? 'A conexão pode ser refeita a qualquer momento.' : 'O Google solicitará sua autorização.'}
            </span>
          </div>
        </section>

        <aside className="google-sync-scope" aria-labelledby="google-sync-scope-title">
          <div className="google-sync-scope-header">
            <ShieldCheck className="w-4 h-4" />
            <div>
              <span className="google-sync-kicker">Escopo autorizado</span>
              <h2 id="google-sync-scope-title">Como funciona</h2>
            </div>
          </div>

          <dl className="google-sync-facts">
            <div>
              <dt>Direção</dt>
              <dd>Organizador → Google Calendar</dd>
            </div>
            <div>
              <dt>Destino</dt>
              <dd>Agenda principal da conta</dd>
            </div>
            <div>
              <dt>Dados enviados</dt>
              <dd>Título, data, horário e categoria</dd>
            </div>
            <div>
              <dt>Leitura externa</dt>
              <dd>Não importa eventos do Google</dd>
            </div>
          </dl>

          <p className="google-sync-privacy-note">
            Esta integração é unidirecional. Seus eventos externos não são exibidos no Organizador nem compartilhados com o Ajudante do Dia.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function AISetupView({ onBack }) {
  const steps = [
    {
      title: 'Baixe e instale o Ollama',
      body: 'O Ollama é o motor que roda os modelos de IA diretamente no seu computador.',
      action: (
        <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="ai-setup-link">
          Baixar Ollama
        </a>
      )
    },
    {
      title: 'Baixe o modelo local',
      body: 'Abra o Terminal ou Prompt de Comando e execute o comando abaixo.',
      action: <code className="ai-setup-command">ollama run qwen3.5:4b</code>
    },
    {
      title: 'Deixe o serviço rodando',
      body: 'Sempre que quiser usar o Ajudante do Dia, mantenha o Ollama aberto. Seus dados continuam na sua máquina.',
      action: null
    }
  ];

  return (
    <div className="ai-setup-view">
      <button type="button" onClick={onBack} className="ai-back-button">
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao painel</span>
      </button>

      <header className="ai-setup-heading">
        <span className="calendar-kicker">Ajudante do Dia · configuração local</span>
        <h1>Ajudante do Dia</h1>
        <p>Configure uma inteligência artificial privada para consultar tarefas, hábitos e notas sem enviar seus dados para fora do computador.</p>
      </header>

      <section className="ai-setup-brief">
        <div className="ai-setup-seal">
          <Brain className="w-6 h-6" />
        </div>
        <div>
          <span className="habit-field-label">BYOAI</span>
          <h2>Traga sua própria IA</h2>
          <p>
            O Organizador Pessoal se conecta a uma IA local. A proposta é simples:
            você mantém controle sobre o modelo, os dados e o contexto usado pelo Ajudante do Dia.
          </p>
        </div>
      </section>

      <section className="ai-setup-steps">
        <h3 className="section-eyebrow section-heading-title">Como ativar · 03 passos</h3>
        <div className="ai-step-list">
          {steps.map((step, index) => (
            <article key={step.title} className="ai-step-card">
              <span className="ai-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
                {step.action && <div className="ai-step-action">{step.action}</div>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ChatView({ currentUser }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatsList, setChatsList] = useState([]);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.email) return undefined;
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.email),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(chatsQuery, (snapshot) => {
      setChatsList(snapshot.docs.map(chatDoc => ({ id: chatDoc.id, ...chatDoc.data() })));
    });
  }, [currentUser]);

  const startChat = (event) => {
    event.preventDefault();
    if (!recipientEmail.trim() || !currentUser?.email) return;

    const emails = [currentUser.email.toLowerCase().trim(), recipientEmail.toLowerCase().trim()].sort();
    setActiveChatId(emails.join('_'));
    setRecipientEmail('');
    setIsStartingNew(false);
  };

  useEffect(() => {
    if (!activeChatId) return undefined;

    const messagesQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(messageDoc => ({ id: messageDoc.id, ...messageDoc.data() })));
      window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [activeChatId]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const chatDocRef = doc(db, 'chats', activeChatId);

    try {
      await addDoc(messagesRef, {
        text: newMessage,
        sender: currentUser.email,
        createdAt: serverTimestamp()
      });

      await setDoc(chatDocRef, {
        participants: activeChatId.split('_'),
        lastMessage: newMessage,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const getRecipientFromChatId = (chatId) => {
    if (!chatId || !currentUser?.email) return '';
    return chatId.split('_').find(email => email !== currentUser.email) || currentUser.email;
  };

  return (
    <div className="messages-view">
      {!activeChatId ? (
        <div className="messages-inbox">
          <div className="messages-heading">
            <div>
              <span className="calendar-kicker">Mensagens · caixa de entrada</span>
              <h1>Mensagens</h1>
            </div>
            <button
              onClick={() => setIsStartingNew(!isStartingNew)}
              className="messages-icon-button"
              aria-label={isStartingNew ? 'Fechar nova conversa' : 'Iniciar nova conversa'}
            >
              {isStartingNew ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>

          {isStartingNew && (
            <div className="messages-start-panel">
              <form onSubmit={startChat} className="messages-start-form">
                <input
                  type="email"
                  placeholder="E-mail da pessoa..."
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  className="messages-start-input"
                  required
                />
                <button type="submit" className="messages-start-button">Iniciar</button>
              </form>
            </div>
          )}

          <div className="messages-list-area">
            {chatsList.length === 0 ? (
              <div className="messages-empty">
                <MessageCircle className="w-9 h-9" />
                <p>Você ainda não tem conversas ativas.</p>
                <button onClick={() => setIsStartingNew(true)} className="messages-empty-action">
                  Iniciar uma nova conversa
                </button>
              </div>
            ) : (
              <ul className="messages-list">
                {chatsList.map((chat) => {
                  const partnerEmail = chat.participants.find(email => email !== currentUser.email) || currentUser.email;
                  return (
                    <li key={chat.id}>
                      <button onClick={() => setActiveChatId(chat.id)} className="messages-thread-button">
                        <div className="messages-thread-avatar">{partnerEmail.charAt(0)}</div>
                        <div className="messages-thread-copy">
                          <p>{partnerEmail}</p>
                          <span>{chat.lastMessage || 'Nenhuma mensagem'}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 messages-thread-arrow" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="messages-chat-header">
            <div className="messages-chat-person">
              <button
                onClick={() => { setActiveChatId(null); setMessages([]); }}
                className="messages-icon-button"
                aria-label="Voltar para conversas"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="messages-thread-avatar">{getRecipientFromChatId(activeChatId).charAt(0)}</div>
              <div>
                <p>{getRecipientFromChatId(activeChatId)}</p>
                <span>Mensagem privada</span>
              </div>
            </div>
          </div>

          <div className="messages-chat-body">
            {messages.length === 0 ? (
              <div className="messages-empty">Nenhuma mensagem ainda.</div>
            ) : (
              messages.map((message) => {
                const isMine = message.sender === currentUser.email;
                return (
                  <div key={message.id} className={`message-row ${isMine ? 'is-mine' : ''}`}>
                    <div className={`message-bubble ${isMine ? 'is-mine' : ''}`}>
                      <p>{message.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="messages-compose">
            <input
              type="text"
              placeholder="Sua mensagem..."
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              className="messages-compose-input"
            />
            <button type="submit" className="messages-send-button" disabled={!newMessage.trim()} aria-label="Enviar mensagem">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
