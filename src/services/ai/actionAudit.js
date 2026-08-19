export const AI_AUDIT_MAX_ENTRIES = 50;
export const AI_AUDIT_MAX_AGE_DAYS = 30;

const ALLOWED_ARGUMENTS = {
  criar_tarefa: ['titulo', 'categoria', 'prazo'],
  editar_tarefa: ['id', 'titulo', 'categoria', 'prazo'],
  mover_tarefa: ['id', 'destino'],
  excluir_tarefa: ['id'],
  criar_nota: ['titulo', 'categoria', 'conteudo'],
  editar_nota: ['id', 'titulo', 'categoria', 'conteudo', 'itens'],
  criar_lista_compras: ['titulo', 'itens'],
  excluir_nota: ['id'],
  criar_evento: ['titulo', 'data', 'hora', 'categoria', 'lembrete_minutos', 'sincronizar_google'],
  editar_evento: ['id', 'titulo', 'data', 'hora', 'categoria', 'lembrete_minutos'],
  excluir_evento: ['id'],
  criar_habito: ['nome', 'frequencia', 'dias', 'cor'],
  editar_habito: ['id', 'nome', 'frequencia', 'dias', 'cor'],
  marcar_habito_do_dia: ['id', 'concluido'],
  excluir_habito: ['id'],
};

const cleanText = (value, maxLength = 240) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const summarizeValue = (key, value) => {
  if (key === 'conteudo') {
    return { omitido: true, caracteres: String(value ?? '').length };
  }
  if (key === 'itens') {
    return { omitido: true, quantidade: Array.isArray(value) ? value.length : 0 };
  }
  if (Array.isArray(value)) return value.slice(0, 7).map(item => cleanText(item, 40));
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return cleanText(value, 180);
};

export function sanitizeAuditArguments(toolName, rawArguments = {}) {
  const allowed = ALLOWED_ARGUMENTS[toolName] || [];
  const input = rawArguments && typeof rawArguments === 'object' && !Array.isArray(rawArguments)
    ? rawArguments
    : {};
  return Object.fromEntries(allowed
    .filter(key => Object.prototype.hasOwnProperty.call(input, key))
    .map(key => [key, summarizeValue(key, input[key])]));
}

export function createAuditEntry({
  toolName,
  arguments: rawArguments,
  confirmation,
  result,
  resultMessage = '',
  collection = null,
  undoOf = null,
}, now = new Date()) {
  const timestamp = now.toISOString();
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return {
    id: `${timestamp}-${randomId}`,
    timestamp,
    toolName: ALLOWED_ARGUMENTS[toolName] ? toolName : 'acao_desconhecida',
    arguments: sanitizeAuditArguments(toolName, rawArguments),
    confirmation: ['confirmed', 'cancelled'].includes(confirmation) ? confirmation : 'unknown',
    result: ['success', 'error', 'cancelled', 'undone'].includes(result) ? result : 'error',
    resultMessage: cleanText(resultMessage),
    collection: cleanText(collection, 40) || null,
    undoOf: cleanText(undoOf, 180) || null,
  };
}

export function appendAuditEntry(entries, entry, {
  now = new Date(),
  maxEntries = AI_AUDIT_MAX_ENTRIES,
  maxAgeDays = AI_AUDIT_MAX_AGE_DAYS,
} = {}) {
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return [entry, ...(Array.isArray(entries) ? entries : [])]
    .filter(item => {
      const time = new Date(item?.timestamp || '').getTime();
      return Number.isFinite(time) && time >= cutoff;
    })
    .slice(0, maxEntries);
}
