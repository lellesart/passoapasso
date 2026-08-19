const TASK_STATUS_LABELS = {
  a_fazer: 'a fazer',
  em_curso: 'em curso',
  concluido: 'concluída',
};

const MAX_TASKS = 40;
const MAX_HABITS = 30;
const MAX_NOTES = 5;
const MAX_EVENTS = 80;
const MAX_NOTE_LENGTH = 180;

const cleanInlineText = (value, fallback = '') => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

const truncate = (value, limit) => {
  const text = cleanInlineText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
};

const formatLimitNotice = (shown, total) => (
  shown < total ? ` Exibindo ${shown} de ${total} registros; o snapshot está parcial.` : ''
);

const sortTasks = (first, second) => {
  if (first.status === 'concluido' && second.status !== 'concluido') return 1;
  if (second.status === 'concluido' && first.status !== 'concluido') return -1;
  if (first.dueDate && second.dueDate) return first.dueDate.localeCompare(second.dueDate);
  if (first.dueDate) return -1;
  if (second.dueDate) return 1;
  return 0;
};

const formatTasks = (tasks) => {
  const storedTasks = tasks.filter(task => !task.deleted).sort(sortTasks);
  const pendingTasks = storedTasks.filter(task => task.status !== 'concluido');
  const completedTasks = storedTasks.filter(task => task.status === 'concluido');
  const shownTasks = [...pendingTasks, ...completedTasks].slice(0, MAX_TASKS);
  const formatTask = (task) => {
    const status = TASK_STATUS_LABELS[task.status] || cleanInlineText(task.status, 'status não informado');
    const title = cleanInlineText(task.title, 'Sem título');
    const category = cleanInlineText(task.category, 'Sem categoria');
    const dueDate = task.dueDate ? ` | prazo: ${task.dueDate}` : '';
    return `- [${status}] ${title} | categoria: ${category}${dueDate}`;
  };
  const pendingLines = shownTasks.filter(task => task.status !== 'concluido').map(formatTask);
  const completedLines = shownTasks.filter(task => task.status === 'concluido').map(formatTask);

  return `TAREFAS (${storedTasks.length} cadastradas; ${pendingTasks.length} pendentes; ${completedTasks.length} concluídas).${formatLimitNotice(shownTasks.length, storedTasks.length)}

TAREFAS PENDENTES (${pendingTasks.length}):
${pendingLines.length ? pendingLines.join('\n') : 'Nenhuma tarefa pendente.'}

TAREFAS CONCLUÍDAS (${completedTasks.length}):
${completedLines.length ? completedLines.join('\n') : 'Nenhuma tarefa concluída.'}`;
};

const formatHabits = (habits, dailyHabitsState) => {
  const activeHabits = habits.filter(habit => !habit.deleted);
  const shownHabits = activeHabits.slice(0, MAX_HABITS);
  const completedToday = dailyHabitsState?.completed || {};
  const stateDate = dailyHabitsState?.lastDate || dailyHabitsState?.currentDate || 'data não informada';
  const lines = shownHabits.map(habit => {
    const name = cleanInlineText(habit.name, 'Sem nome');
    const recurrence = cleanInlineText(habit.recurrence, 'Frequência não informada');
    const state = completedToday[habit.id] ? 'feito' : 'pendente';
    return `- ${name} | recorrência: ${recurrence} | estado em ${stateDate}: ${state}`;
  });

  return `HÁBITOS (${activeHabits.length} ativos).${formatLimitNotice(shownHabits.length, activeHabits.length)}\n${lines.length ? lines.join('\n') : 'Nenhum hábito cadastrado.'}`;
};

const getShoppingSummary = (note) => {
  if (!Array.isArray(note.items)) return truncate(note.content, MAX_NOTE_LENGTH);
  const checkedCount = note.items.filter(item => item.checked).length;
  const itemNames = note.items.map(item => cleanInlineText(item.text)).filter(Boolean).join(', ');
  return `${checkedCount}/${note.items.length} itens marcados${itemNames ? `: ${truncate(itemNames, MAX_NOTE_LENGTH)}` : ''}`;
};

const formatNotes = (notes) => {
  const activeNotes = notes.filter(note => !note.deleted);
  const shownNotes = activeNotes.slice(0, MAX_NOTES);
  const lines = shownNotes.map(note => {
    const title = cleanInlineText(note.title, 'Sem título');
    const category = cleanInlineText(note.category, 'Sem categoria');
    const summary = note.category === 'Compras' ? getShoppingSummary(note) : truncate(note.content, MAX_NOTE_LENGTH);
    return `- ${title} | categoria: ${category}${summary ? ` | trecho: ${summary}` : ' | sem conteúdo'}`;
  });

  return `NOTAS RECENTES (${activeNotes.length} ativas).${formatLimitNotice(shownNotes.length, activeNotes.length)}\n${lines.length ? lines.join('\n') : 'Nenhuma nota cadastrada.'}`;
};

const formatEvents = (events) => {
  const activeEvents = events
    .filter(event => !event.deleted && event.date)
    .sort((first, second) => `${first.date}T${first.time || '00:00'}`.localeCompare(`${second.date}T${second.time || '00:00'}`));
  const shownEvents = activeEvents.slice(0, MAX_EVENTS);
  const lines = shownEvents.map(event => {
    const title = cleanInlineText(event.title, 'Sem título');
    const category = cleanInlineText(event.category, 'Sem categoria');
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
      .format(new Date(`${event.date}T12:00:00Z`));
    return `- ${weekday}, ${event.date} às ${event.time || 'horário não informado'} | ${title} | categoria: ${category}`;
  });

  return `EVENTOS DO CALENDÁRIO DO ORGANIZADOR (${activeEvents.length} ativos).${formatLimitNotice(shownEvents.length, activeEvents.length)}\n${lines.length ? lines.join('\n') : 'Nenhum evento cadastrado no calendário do Organizador.'}`;
};

export function buildOrganizerSnapshot({
  tasks = [],
  habits = [],
  notes = [],
  events = [],
  dailyHabitsState = null,
} = {}) {
  return `SNAPSHOT ATUAL DO ORGANIZADOR

${formatTasks(tasks)}

${formatHabits(habits, dailyHabitsState)}

${formatNotes(notes)}

${formatEvents(events)}`;
}

export function buildOrganizerSummary({ googleCalendarConnected = false } = {}) {
  return `DADOS DO ORGANIZADOR
Nenhum registro, título, conteúdo, estado ou contagem foi incluído nesta mensagem.
Integração Google Calendar: ${googleCalendarConnected ? 'conectada' : 'não conectada'}.
Consulte as ferramentas antes de responder sobre tarefas, hábitos, notas ou eventos, inclusive quando a pergunta pedir apenas uma contagem.`;
}
