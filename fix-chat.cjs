const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /function ChatView.*?^}/ms;
const replacement = `function ChatView({ currentUser }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatsList, setChatsList] = useState([]);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const messagesEndRef = React.useRef(null);

  // Fetch list of chats
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', currentUser.email),
      orderBy('updatedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatsList(fetchedChats);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  const startChat = (e) => {
    e.preventDefault();
    if (!recipientEmail.trim() || !currentUser || !currentUser.email) return;
    
    const emails = [currentUser.email.toLowerCase().trim(), recipientEmail.toLowerCase().trim()].sort();
    const chatId = emails.join('_');
    setActiveChatId(chatId);
    setRecipientEmail('');
    setIsStartingNew(false);
  };

  useEffect(() => {
    if (!activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const chatDocRef = doc(db, 'chats', activeChatId);
    
    try {
      // 1. Send the actual message
      await addDoc(messagesRef, {
        text: newMessage,
        sender: currentUser.email,
        createdAt: serverTimestamp()
      });
      
      // 2. Update or create the parent document so it appears in the chat list
      const emails = activeChatId.split('_');
      await setDoc(chatDocRef, {
        participants: emails,
        lastMessage: newMessage,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Determine the name of the person we are talking to for the active chat header
  const getRecipientFromChatId = (chatId) => {
    if (!chatId || !currentUser || !currentUser.email) return '';
    return chatId.split('_').find(e => e !== currentUser.email) || currentUser.email;
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-[600px] flex flex-col overflow-hidden border border-stone-100">
      {!activeChatId ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
            <h3 className="font-bold text-stone-800">Mensagens</h3>
            <button 
              onClick={() => setIsStartingNew(!isStartingNew)}
              className="text-stone-500 hover:text-stone-900 transition-colors p-2 rounded-md hover:bg-stone-200"
            >
              {isStartingNew ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
          
          {isStartingNew && (
            <div className="p-4 border-b border-stone-100 bg-white">
              <form onSubmit={startChat} className="flex space-x-2">
                <input 
                  type="email" 
                  placeholder="E-mail da pessoa..." 
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="flex-1 px-4 py-2 bg-stone-50 border-0 rounded-lg focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none"
                  required
                />
                <button type="submit" className="px-4 py-2 bg-stone-900 text-white font-bold rounded-lg hover:bg-stone-800 transition-colors text-sm">
                  Iniciar
                </button>
              </form>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {chatsList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <MessageCircle className="w-12 h-12 text-stone-300" />
                <p className="text-stone-500 text-sm">Você ainda não tem conversas ativas.</p>
                <button 
                  onClick={() => setIsStartingNew(true)}
                  className="text-sm font-bold text-stone-800 hover:underline"
                >
                  Iniciar uma nova conversa
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {chatsList.map(chat => {
                  const partnerEmail = chat.participants.find(e => e !== currentUser.email) || currentUser.email;
                  return (
                    <li key={chat.id}>
                      <button 
                        onClick={() => setActiveChatId(chat.id)}
                        className="w-full flex items-center p-4 hover:bg-stone-50 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold uppercase shrink-0">
                          {partnerEmail.charAt(0)}
                        </div>
                        <div className="ml-4 flex-1 overflow-hidden">
                          <p className="font-bold text-stone-800 truncate">{partnerEmail}</p>
                          <p className="text-sm text-stone-500 truncate">{chat.lastMessage || 'Nenhuma mensagem'}</p>
                        </div>
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
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
            <div className="flex items-center space-x-3">
              <button onClick={() => { setActiveChatId(null); setMessages([]); }} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3 ml-2">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold uppercase">
                  {getRecipientFromChatId(activeChatId).charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-stone-800 text-sm">{getRecipientFromChatId(activeChatId)}</p>
                  <p className="text-xs text-stone-400 font-medium tracking-wider">MENSAGEM PRIVADA</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-stone-400 text-sm font-medium">
                Nenhuma mensagem ainda. Dê um oi! 👋
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender === currentUser.email;
                return (
                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'}\`}>
                    <div className={\`max-w-[75%] px-4 py-2.5 text-sm \${isMine ? 'bg-stone-900 text-white rounded-2xl rounded-tr-sm shadow-sm' : 'bg-white text-stone-800 border border-stone-100 rounded-2xl rounded-tl-sm shadow-sm'}\`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 bg-white border-t border-stone-100 flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="Sua mensagem..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-3 bg-stone-50 border-0 rounded-full focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none"
            />
            <button type="submit" className="p-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors shadow-sm" disabled={!newMessage.trim()}>
              <Send className="w-5 h-5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.jsx', code);
