import { READ_ONLY_TOOL_SCHEMAS, WRITE_TOOL_SCHEMAS } from './toolSchemas.js';

const READ_TOOLS_BY_DOMAIN = {
  events: new Set(['listar_eventos', 'obter_evento']),
  tasks: new Set(['listar_tarefas', 'obter_tarefa']),
  notes: new Set(['listar_notas', 'obter_nota']),
  habits: new Set(['listar_habitos', 'obter_habito']),
};

const WRITE_TOOLS_BY_DOMAIN = {
  events: new Set(['criar_evento', 'editar_evento', 'excluir_evento']),
  tasks: new Set(['criar_tarefa', 'editar_tarefa', 'mover_tarefa', 'excluir_tarefa']),
  notes: new Set(['criar_nota', 'editar_nota', 'criar_lista_compras', 'excluir_nota']),
  habits: new Set(['criar_habito', 'editar_habito', 'marcar_habito_do_dia', 'excluir_habito']),
};

const DOMAIN_PATTERNS = {
  events: /\b(evento|eventos|agenda|calend[aá]rio|compromisso|compromissos|marcad[oa]s?|disponibilidade)\b/i,
  tasks: /\b(tarefa|tarefas|pendente|pendentes|prazo|prazos|prioridade|prioridades|em curso|a fazer|conclu[ií]d[oa]s?)\b/i,
  notes: /\b(nota|notas|anota[cç][aã]o|anota[cç][oõ]es|lista de compras|mercado|compras)\b/i,
  habits: /\b(h[aá]bito|h[aá]bitos|feito hoje|rotina|recorr[eê]ncia)\b/i,
};

const WRITE_INTENT = /\b(crie|criar|adicione|adicionar|edite|editar|altere|alterar|renomeie|renomear|mova|mover|coloque|colocar|conclua|concluir|marque|marcar|desmarque|desmarcar|transforme|transformar|exclua|excluir|apague|apagar|remova|remover)\b/i;

const latestUserText = messages => [...(messages || [])]
  .reverse()
  .find(message => message.role === 'user')?.content || '';

export function selectOrganizerTools(messages, { allowWrites = false } = {}) {
  const text = latestUserText(messages);
  const domains = Object.entries(DOMAIN_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([domain]) => domain);
  const selectedDomains = domains.length ? domains : Object.keys(READ_TOOLS_BY_DOMAIN);
  const readNames = new Set(selectedDomains.flatMap(domain => [...READ_TOOLS_BY_DOMAIN[domain]]));
  const selected = READ_ONLY_TOOL_SCHEMAS.filter(tool => readNames.has(tool.function.name));

  if (!allowWrites || !WRITE_INTENT.test(text)) return selected;

  const writableDomains = domains.filter(domain => WRITE_TOOLS_BY_DOMAIN[domain]);
  const writeDomains = writableDomains.length
    ? writableDomains
    : domains.length
      ? []
      : Object.keys(WRITE_TOOLS_BY_DOMAIN);
  const writeNames = new Set(writeDomains.flatMap(domain => [...WRITE_TOOLS_BY_DOMAIN[domain]]));
  return [
    ...selected,
    ...WRITE_TOOL_SCHEMAS.filter(tool => writeNames.has(tool.function.name)),
  ];
}
