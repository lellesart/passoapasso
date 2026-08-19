import { READ_ONLY_TOOL_NAMES } from './toolSchemas.js';
import { frequencyFromHabit, habitColorLabel } from './habitModel.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const VALID_TASK_STATUSES = new Set(['a_fazer', 'em_curso', 'concluido']);

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

const contains = (value, query) => !query || normalize(value).includes(normalize(query));

const parseArguments = (args) => {
  if (args == null) return {};
  if (typeof args === 'object' && !Array.isArray(args)) return args;
  if (typeof args !== 'string') return {};
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const getLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
};

const isValidDate = (value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
};

const invalidDateResult = (field) => ({
  ok: false,
  error: `O campo ${field} deve usar o formato YYYY-MM-DD.`,
});

const activeOnly = (records) => records.filter(record => !record.deleted);

const noteSearchText = (note) => [
  note.title,
  note.content,
  ...(Array.isArray(note.items) ? note.items.map(item => item.text) : []),
].join(' ');

const taskResult = (task) => ({
  id: String(task.id),
  titulo: task.title || 'Sem título',
  categoria: task.category || 'Sem categoria',
  status: task.status || 'a_fazer',
  prazo: task.dueDate || null,
  prazo_formatado: formatDate(task.dueDate),
  prioridade: task.priority || null,
});

const eventResult = (event) => ({
  id: String(event.id),
  titulo: event.title || 'Sem título',
  data: event.date,
  data_formatada: formatDate(event.date),
  hora: event.time || null,
  categoria: event.category || 'Sem categoria',
  lembrete_minutos: event.reminderMinutes ?? null,
  sincronizado_google: Boolean(event.googleEventId),
});

const notePreviewResult = (note) => ({
  id: String(note.id),
  titulo: note.title || 'Sem título',
  categoria: note.category || 'Sem categoria',
  previa: normalize(note.category) === 'compras' && Array.isArray(note.items)
    ? `${note.items.filter(item => item.checked).length}/${note.items.length} itens marcados: ${note.items.map(item => item.text).join(', ')}`.slice(0, 220)
    : String(note.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
});

const noteFullResult = (note) => ({
  ...notePreviewResult(note),
  conteudo: note.content || '',
  itens: Array.isArray(note.items)
    ? note.items.map(item => ({ id: String(item.id), texto: item.text, marcado: Boolean(item.checked) }))
    : null,
});

const habitResult = (habit, dailyHabitsState) => {
  const schedule = frequencyFromHabit(habit);
  return {
    id: String(habit.id),
    nome: habit.name || 'Sem nome',
    recorrencia: habit.recurrence || 'Não informada',
    frequencia: schedule.frequency,
    dias: schedule.days,
    cor: habitColorLabel(habit.color),
    feito_hoje: Boolean(dailyHabitsState?.completed?.[habit.id]),
    data_estado: dailyHabitsState?.lastDate || dailyHabitsState?.currentDate || null,
  };
};

const successList = (items, total) => ({
  ok: true,
  total_encontrado: total,
  retornados: items.length,
  parcial: items.length < total,
  itens: items,
});

const findActiveById = (records, id) => activeOnly(records).find(record => String(record.id) === String(id));

export function executeReadOnlyTool(toolName, rawArguments, organizerData = {}) {
  if (!READ_ONLY_TOOL_NAMES.has(toolName)) {
    return { ok: false, error: `Ferramenta de leitura não permitida: ${toolName}` };
  }

  const args = parseArguments(rawArguments);
  const tasks = organizerData.tasks || [];
  const habits = organizerData.habits || [];
  const notes = organizerData.notes || [];
  const events = organizerData.events || [];
  const dailyHabitsState = organizerData.dailyHabitsState || null;

  switch (toolName) {
    case 'listar_eventos': {
      if (!isValidDate(args.data_inicial)) return invalidDateResult('data_inicial');
      if (!isValidDate(args.data_final)) return invalidDateResult('data_final');
      const filtered = activeOnly(events)
        .filter(event => event.date)
        .filter(event => !args.data_inicial || event.date >= args.data_inicial)
        .filter(event => !args.data_final || event.date <= args.data_final)
        .filter(event => contains(event.category, args.categoria))
        .filter(event => contains(event.title, args.busca))
        .sort((first, second) => `${first.date}T${first.time || '00:00'}`.localeCompare(`${second.date}T${second.time || '00:00'}`));
      const items = filtered.slice(0, getLimit(args.limite)).map(eventResult);
      return successList(items, filtered.length);
    }
    case 'obter_evento': {
      const event = findActiveById(events, args.id);
      return event ? { ok: true, evento: eventResult(event) } : { ok: false, error: 'Evento ativo não encontrado.' };
    }
    case 'listar_tarefas': {
      if (args.status && !VALID_TASK_STATUSES.has(args.status)) {
        return { ok: false, error: 'Status de tarefa inválido.' };
      }
      if (!isValidDate(args.prazo_inicial)) return invalidDateResult('prazo_inicial');
      if (!isValidDate(args.prazo_final)) return invalidDateResult('prazo_final');
      const filtered = activeOnly(tasks)
        .filter(task => !args.status || task.status === args.status)
        .filter(task => contains(task.category, args.categoria))
        .filter(task => contains(task.title, args.busca))
        .filter(task => !args.prazo_inicial || (task.dueDate && task.dueDate >= args.prazo_inicial))
        .filter(task => !args.prazo_final || (task.dueDate && task.dueDate <= args.prazo_final))
        .sort((first, second) => (first.dueDate || '9999-12-31').localeCompare(second.dueDate || '9999-12-31'));
      const items = filtered.slice(0, getLimit(args.limite)).map(taskResult);
      return successList(items, filtered.length);
    }
    case 'obter_tarefa': {
      const task = findActiveById(tasks, args.id);
      return task ? { ok: true, tarefa: taskResult(task) } : { ok: false, error: 'Tarefa ativa não encontrada.' };
    }
    case 'listar_notas': {
      const filtered = activeOnly(notes)
        .filter(note => contains(note.category, args.categoria))
        .filter(note => contains(noteSearchText(note), args.busca));
      const items = filtered.slice(0, getLimit(args.limite)).map(notePreviewResult);
      return successList(items, filtered.length);
    }
    case 'obter_nota': {
      const note = findActiveById(notes, args.id);
      return note ? { ok: true, nota: noteFullResult(note) } : { ok: false, error: 'Nota ativa não encontrada.' };
    }
    case 'listar_habitos': {
      const filtered = activeOnly(habits)
        .filter(habit => contains(habit.name, args.busca))
        .filter(habit => typeof args.feito_hoje !== 'boolean'
          || Boolean(dailyHabitsState?.completed?.[habit.id]) === args.feito_hoje);
      const items = filtered.slice(0, getLimit(args.limite)).map(habit => habitResult(habit, dailyHabitsState));
      return successList(items, filtered.length);
    }
    case 'obter_habito': {
      const habit = findActiveById(habits, args.id);
      return habit
        ? { ok: true, habito: habitResult(habit, dailyHabitsState) }
        : { ok: false, error: 'Hábito ativo não encontrado.' };
    }
    default:
      return { ok: false, error: 'Ferramenta não implementada.' };
  }
}
