/**
 * Service to communicate with Local LLM (Ollama)
 */

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

/**
 * Checks if Ollama service is reachable and returns the list of available models.
 * @param {string} host 
 * @returns {Promise<{ online: boolean, models: string[], error?: string }>}
 */
export async function checkOllamaStatus(host = DEFAULT_OLLAMA_HOST) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${host}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { online: false, models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const models = (data.models || []).map((m) => m.name);

    return {
      online: true,
      models,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isMixedContentError = isHttps && host.startsWith('http://');

    return {
      online: false,
      models: [],
      error: isMixedContentError
        ? 'Acesso via HTTPS (Netlify) bloqueia requisições HTTP para Ollama local (Mixed Content).'
        : 'Servidor Ollama não encontrado em ' + host,
    };
  }
}

/**
 * Sends a chat completion request to Ollama with streaming response support.
 * 
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages - Array of chat messages
 * @param {string} [options.systemContext] - System instructions with app context
 * @param {string} [options.model] - Target Ollama model name (e.g. 'llama3.2', 'qwen2.5')
 * @param {function(string): void} [options.onChunk] - Callback for streaming text chunks
 * @param {string} [options.host] - Ollama API host address
 * @param {AbortSignal} [options.signal] - Abort controller signal
 * @returns {Promise<string>} Full response text
 */
export async function sendChatMessageStream({
  messages,
  systemContext = '',
  model = 'llama3.2',
  onChunk = null,
  host = DEFAULT_OLLAMA_HOST,
  signal = null,
}) {
  const formattedMessages = [];

  if (systemContext) {
    formattedMessages.push({
      role: 'system',
      content: systemContext,
    });
  }

  formattedMessages.push(...messages);

  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Erro Ollama (${response.status}): ${errorText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Servidor não retornou corpo de resposta para streaming.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          const chunkContent = parsed.message?.content || '';
          if (chunkContent) {
            fullText += chunkContent;
            if (onChunk) {
              onChunk(chunkContent, fullText);
            }
          }
        } catch (e) {
          // Ignore partial line JSON errors
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        const chunkContent = parsed.message?.content || '';
        if (chunkContent) {
          fullText += chunkContent;
          if (onChunk) {
            onChunk(chunkContent, fullText);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return fullText;
  } catch (error) {
    if (error.name === 'AbortError') {
      return fullText || '';
    }
    throw error;
  }
}

/**
 * Builds system context prompt summarizing the user's current tasks, habits, and notes.
 */
export function buildSystemContext({ tasks = [], habits = [], notes = [], user = null }) {
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Format pending tasks
  const pendingTasks = tasks.filter(t => !t.completed && !t.deleted);
  const tasksSummary = pendingTasks.length > 0
    ? pendingTasks.map(t => `- [${t.priority || 'Normal'}] ${t.title}${t.dueDate ? ` (Para: ${t.dueDate})` : ''}`).join('\n')
    : 'Nenhuma tarefa pendente no momento.';

  // Format active habits
  const activeHabits = habits.filter(h => !h.deleted);
  const habitsSummary = activeHabits.length > 0
    ? activeHabits.map(h => `- ${h.title} (Frequência: ${h.frequency || 'Diário'})`).join('\n')
    : 'Nenhum hábito cadastrado.';

  // Format recent notes summary
  const recentNotes = notes.filter(n => !n.deleted).slice(0, 5);
  const notesSummary = recentNotes.length > 0
    ? recentNotes.map(n => `- ${n.title || 'Sem título'}: ${n.content ? n.content.substring(0, 80) + '...' : ''}`).join('\n')
    : 'Nenhuma nota recente.';

  return `Você é um grande amigo do usuário ${userName}. Vocês se conhecem há muito tempo e você tem acesso fiel a toda a rotina dele através do aplicativo "Organizador Pessoal".
Data de Hoje: ${todayStr}.

Sua missão é atuar como um amigo conselheiro e de confiança, que ajuda o ${userName} não apenas a organizar o dia e aliviar a sobrecarga mental, mas também a resolver qualquer tipo de dúvida da vida pessoal ou profissional.
Você deve responder em português do Brasil, usando um tom pessoal, próximo e direto (como uma conversa real de WhatsApp entre grandes amigos).

--- ROTINA DO ${userName.toUpperCase()} ---

TAREFAS PENDENTES (${pendingTasks.length}):
${tasksSummary}

HÁBITOS:
${habitsSummary}

NOTAS RECENTES:
${notesSummary}

--- INSTRUÇÕES DE COMPORTAMENTO ---
- Aja estritamente como um amigo de longa data conversando. Vá direto ao ponto, com intimidade e empatia.
- Não use emojis em hipótese alguma. Mantenha a comunicação madura, limpa e direta.
- Formate suas respostas de forma simples e fácil de ler. Use bullet points apenas se for estritamente necessário para não poluir o texto. Não crie listas desnecessárias.
- Quando o usuário pedir conselhos pessoais ou profissionais, baseie-se no que você sabe da rotina dele (notas, tarefas, hábitos) para dar respostas personalizadas e maduras.
- Quando ele precisar de ajuda para priorizar tarefas, sugira diretamente 1 ou 2 coisas da lista que fazem sentido para o momento e pergunte se ele topa começar por elas.
- O modelo em que você roda é leve, então seja preciso e conciso. Prefira respostas curtas e conectadas à realidade do usuário ao invés de textos longos e teóricos.
`;
}
