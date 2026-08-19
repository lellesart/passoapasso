/**
 * Service to communicate with Local LLM (Ollama)
 */

import { buildAssistantPersona } from './ai/assistantPersona.js';
import { buildOrganizerSnapshot, buildOrganizerSummary } from './ai/organizerContext.js';
import {
  READ_ONLY_TOOL_SCHEMAS,
  WRITE_TOOL_NAMES,
} from './ai/toolSchemas.js';
import { executeReadOnlyTool } from './ai/readTools.js';
import { buildActionProposal } from './ai/actionValidation.js';
import { selectOrganizerTools } from './ai/toolRegistry.js';

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
  } catch {
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

async function streamOllamaChat({
  messages,
  model = 'qwen3.5:4b',
  tools = null,
  onChunk = null,
  host = DEFAULT_OLLAMA_HOST,
  signal = null,
  temperature = 0.2,
  numPredict = 1024,
}) {
  let fullText = '';
  let toolCalls = [];
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        think: false,
        ...(tools?.length ? { tools } : {}),
        options: {
          temperature,
          num_ctx: 8192,
          num_predict: numPredict,
        },
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
    let buffer = '';

    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
        const chunkContent = parsed.message?.content || '';
        if (chunkContent) {
          fullText += chunkContent;
          onChunk?.(chunkContent, fullText);
        }
        if (Array.isArray(parsed.message?.tool_calls) && parsed.message.tool_calls.length > 0) {
          toolCalls = parsed.message.tool_calls;
        }
      } catch {
        // A linha incompleta permanece no buffer e será processada no próximo chunk.
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(processLine);
    }

    if (buffer.trim()) processLine(buffer);

    return {
      message: {
        role: 'assistant',
        content: fullText,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      content: fullText,
      toolCalls,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        message: { role: 'assistant', content: fullText },
        content: fullText,
        toolCalls: [],
      };
    }
    throw error;
  }
}

/**
 * Sends a regular chat completion request with streaming text.
 */
export async function sendChatMessageStream({
  messages,
  systemContext = '',
  model = 'qwen3.5:4b',
  onChunk = null,
  host = DEFAULT_OLLAMA_HOST,
  signal = null,
}) {
  const formattedMessages = systemContext
    ? [{ role: 'system', content: systemContext }, ...messages]
    : [...messages];
  const response = await streamOllamaChat({
    messages: formattedMessages,
    model,
    onChunk,
    host,
    signal,
  });
  return response.content;
}

/**
 * Runs a bounded read-only tool loop. The model can request only the schemas in
 * READ_ONLY_TOOL_SCHEMAS and every call is executed against the latest React state.
 */
async function runOrganizerAgent({
  messages,
  organizerData,
  systemContext = '',
  model = 'qwen3.5:4b',
  onChunk = null,
  onToolCall = null,
  host = DEFAULT_OLLAMA_HOST,
  signal = null,
  maxToolCalls = 3,
  allowWrites = false,
}) {
  const conversation = systemContext
    ? [{ role: 'system', content: systemContext }, ...messages]
    : [...messages];
  let executedToolCalls = 0;
  let hasUniqueEventLookup = false;
  let hasUniqueHabitLookup = false;
  let hasUniqueTaskLookup = false;
  let hasUniqueNoteLookup = false;
  const availableTools = allowWrites
    ? selectOrganizerTools(messages, { allowWrites: true })
    : READ_ONLY_TOOL_SCHEMAS;

  for (let iteration = 0; iteration < maxToolCalls + 2; iteration += 1) {
    const tools = executedToolCalls < maxToolCalls ? availableTools : null;
    const response = await streamOllamaChat({
      messages: conversation,
      model,
      tools,
      onChunk,
      host,
      signal,
      temperature: executedToolCalls === 0 ? 0 : 0.2,
      numPredict: executedToolCalls === 0 ? 512 : 1024,
    });

    conversation.push(response.message);
    if (response.toolCalls.length === 0) {
      return { content: response.content, pendingAction: null };
    }

    for (const call of response.toolCalls) {
      if (executedToolCalls >= maxToolCalls) {
        conversation.push({
          role: 'tool',
          tool_name: call.function?.name || 'ferramenta_desconhecida',
          content: JSON.stringify({ ok: false, error: 'Limite de ferramentas atingido.' }),
        });
        continue;
      }

      const toolName = call.function?.name || '';
      const toolArguments = call.function?.arguments || {};
      if (allowWrites && WRITE_TOOL_NAMES.has(toolName)) {
        if (['editar_evento', 'excluir_evento'].includes(toolName) && !hasUniqueEventLookup) {
          const lookupError = {
            ok: false,
            error: 'Antes de editar ou excluir, use listar_eventos com filtros que retornem exatamente um evento. Se houver mais de um, peça esclarecimento ao usuário.',
          };
          executedToolCalls += 1;
          onToolCall?.({ name: toolName, arguments: toolArguments, result: lookupError });
          conversation.push({
            role: 'tool',
            tool_name: toolName,
            content: JSON.stringify(lookupError),
          });
          continue;
        }
        if (['editar_habito', 'marcar_habito_do_dia', 'excluir_habito'].includes(toolName) && !hasUniqueHabitLookup) {
          const lookupError = {
            ok: false,
            error: 'Antes de editar, marcar, desmarcar ou excluir, use listar_habitos com uma busca que retorne exatamente um hábito. Se houver mais de um, peça esclarecimento ao usuário.',
          };
          executedToolCalls += 1;
          onToolCall?.({ name: toolName, arguments: toolArguments, result: lookupError });
          conversation.push({
            role: 'tool',
            tool_name: toolName,
            content: JSON.stringify(lookupError),
          });
          continue;
        }
        if (toolName === 'excluir_tarefa' && !hasUniqueTaskLookup) {
          const lookupError = {
            ok: false,
            error: 'Antes de excluir, use listar_tarefas com filtros que retornem exatamente uma tarefa. Se houver mais de uma, peça esclarecimento ao usuário.',
          };
          executedToolCalls += 1;
          onToolCall?.({ name: toolName, arguments: toolArguments, result: lookupError });
          conversation.push({ role: 'tool', tool_name: toolName, content: JSON.stringify(lookupError) });
          continue;
        }
        if (toolName === 'excluir_nota' && !hasUniqueNoteLookup) {
          const lookupError = {
            ok: false,
            error: 'Antes de excluir, use listar_notas com filtros que retornem exatamente uma nota. Se houver mais de uma, peça esclarecimento ao usuário.',
          };
          executedToolCalls += 1;
          onToolCall?.({ name: toolName, arguments: toolArguments, result: lookupError });
          conversation.push({ role: 'tool', tool_name: toolName, content: JSON.stringify(lookupError) });
          continue;
        }
        const proposalResult = buildActionProposal(toolName, toolArguments, organizerData);
        executedToolCalls += 1;
        onToolCall?.({ name: toolName, arguments: toolArguments, result: proposalResult });
        if (proposalResult.ok) {
          return {
            content: response.content,
            pendingAction: proposalResult.proposal,
          };
        }
        conversation.push({
          role: 'tool',
          tool_name: toolName,
          content: JSON.stringify(proposalResult),
        });
        continue;
      }

      const result = executeReadOnlyTool(toolName, toolArguments, organizerData);
      if (toolName === 'listar_eventos') {
        hasUniqueEventLookup = result.ok && result.total_encontrado === 1;
      }
      if (toolName === 'listar_habitos') {
        hasUniqueHabitLookup = result.ok && result.total_encontrado === 1;
      }
      if (toolName === 'listar_tarefas') {
        hasUniqueTaskLookup = result.ok && result.total_encontrado === 1;
      }
      if (toolName === 'listar_notas') {
        hasUniqueNoteLookup = result.ok && result.total_encontrado === 1;
      }
      executedToolCalls += 1;
      onToolCall?.({ name: toolName, arguments: toolArguments, result });
      conversation.push({
        role: 'tool',
        tool_name: toolName,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error('O assistente excedeu o limite de chamadas de ferramenta.');
}

export async function sendReadOnlyAgentMessageStream(options) {
  const result = await runOrganizerAgent({ ...options, allowWrites: false });
  return result.content;
}

/**
 * Allows the model to propose task and note writes. A validated proposal is
 * returned to the UI but is never executed by this service.
 */
export function sendOrganizerAgentMessageStream(options) {
  return runOrganizerAgent({ ...options, allowWrites: true });
}

/**
 * Builds the trusted read-only system context from versioned persona rules and
 * either a compact summary for tool mode or a bounded snapshot for fallback mode.
 */
export function buildSystemContext(data = {}) {
  const organizerContext = data.toolsEnabled
    ? buildOrganizerSummary(data)
    : buildOrganizerSnapshot(data);
  return `${buildAssistantPersona(data)}\n\n${organizerContext}`;
}
