import { WRITE_TOOL_NAMES } from './toolSchemas.js';
import {
  HABIT_COLORS,
  HABIT_FREQUENCIES,
  frequencyFromHabit,
  habitColorLabel,
  normalizeHabitDays,
  organizerDateKey,
  recurrenceFromFrequency,
} from './habitModel.js';

const TASK_CATEGORIES = new Set(['Trabalho', 'Pessoal', 'Saúde', 'Estudos']);
const NOTE_CATEGORIES = new Set(['Trabalho', 'Pessoal', 'Saúde', 'Estudos', 'Compras']);
const EVENT_CATEGORIES = new Set(['Trabalho', 'Pessoal', 'Saúde', 'Estudos']);
const TASK_STATUSES = new Set(['a_fazer', 'em_curso', 'concluido']);
const STATUS_LABELS = {
  a_fazer: 'A fazer',
  em_curso: 'Em curso',
  concluido: 'Concluído',
};

const parseArguments = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const cleanText = (value, maxLength) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const cleanContent = (value, maxLength = 12000) => String(value ?? '').trim().slice(0, maxLength);

const isValidDate = (value) => {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');

const parseReminder = (value, fallback = 15) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10080 ? parsed : null;
};

const formatDate = (value) => {
  if (!value) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
};

const findActive = (records, id) => records.find(record => !record.deleted && String(record.id) === String(id));

const cleanItems = (items) => {
  if (!Array.isArray(items)) return null;
  return items
    .map(item => cleanText(typeof item === 'string' ? item : item?.text, 180))
    .filter(Boolean)
    .slice(0, 50);
};

const failure = error => ({ ok: false, error });

const proposal = (toolName, args, title, description, displayFields, options = {}) => ({
  ok: true,
  proposal: {
    toolName,
    arguments: args,
    title,
    description,
    displayFields,
    requiresConfirmation: true,
    confirmationLevel: 'standard',
    ...options,
  },
});

export function buildActionProposal(toolName, rawArguments, organizerData = {}) {
  if (!WRITE_TOOL_NAMES.has(toolName)) return failure(`Ação não permitida: ${toolName}`);

  const input = parseArguments(rawArguments);
  const tasks = organizerData.tasks || [];
  const notes = organizerData.notes || [];
  const events = organizerData.events || [];
  const habits = organizerData.habits || [];
  const dailyHabitsState = organizerData.dailyHabitsState || {};
  const googleCalendarConnected = Boolean(organizerData.googleCalendarConnected);

  switch (toolName) {
    case 'criar_tarefa': {
      const title = cleanText(input.titulo, 180);
      const category = input.categoria;
      const dueDate = input.prazo == null ? '' : String(input.prazo).trim();
      if (!title) return failure('Informe o título da tarefa.');
      if (!TASK_CATEGORIES.has(category)) return failure('Escolha uma categoria válida para a tarefa.');
      if (!isValidDate(dueDate)) return failure('O prazo deve usar uma data válida no formato YYYY-MM-DD.');
      return proposal(toolName, { titulo: title, categoria: category, prazo: dueDate }, 'Criar tarefa', 'A tarefa será adicionada em A fazer.', [
        { label: 'Tarefa', value: title },
        { label: 'Categoria', value: category },
        { label: 'Prazo', value: formatDate(dueDate) },
      ]);
    }
    case 'editar_tarefa': {
      const task = findActive(tasks, input.id);
      if (!task) return failure('A tarefa ativa não foi encontrada. Consulte as tarefas novamente.');
      const changes = {};
      if ('titulo' in input) {
        const title = cleanText(input.titulo, 180);
        if (!title) return failure('O título da tarefa não pode ficar vazio.');
        changes.titulo = title;
      }
      if ('categoria' in input) {
        if (!TASK_CATEGORIES.has(input.categoria)) return failure('Escolha uma categoria válida para a tarefa.');
        changes.categoria = input.categoria;
      }
      if ('prazo' in input) {
        const dueDate = input.prazo == null ? '' : String(input.prazo).trim();
        if (!isValidDate(dueDate)) return failure('O prazo deve usar uma data válida no formato YYYY-MM-DD.');
        changes.prazo = dueDate;
      }
      if (Object.keys(changes).length === 0) return failure('Informe ao menos uma alteração para a tarefa.');
      const fields = [{ label: 'Tarefa', value: task.title || 'Sem título' }];
      if ('titulo' in changes) fields.push({ label: 'Novo título', value: changes.titulo });
      if ('categoria' in changes) fields.push({ label: 'Nova categoria', value: changes.categoria });
      if ('prazo' in changes) fields.push({ label: 'Novo prazo', value: formatDate(changes.prazo) });
      return proposal(toolName, { id: String(task.id), ...changes }, 'Editar tarefa', 'Somente os campos apresentados serão alterados.', fields);
    }
    case 'mover_tarefa': {
      const task = findActive(tasks, input.id);
      if (!task) return failure('A tarefa ativa não foi encontrada. Consulte as tarefas novamente.');
      if (!TASK_STATUSES.has(input.destino)) return failure('Escolha um destino válido para a tarefa.');
      if (task.status === input.destino) return failure(`A tarefa já está em ${STATUS_LABELS[input.destino]}.`);
      return proposal(toolName, { id: String(task.id), destino: input.destino }, 'Mover tarefa', 'O status da tarefa será atualizado.', [
        { label: 'Tarefa', value: task.title || 'Sem título' },
        { label: 'De', value: STATUS_LABELS[task.status] || task.status || 'A fazer' },
        { label: 'Para', value: STATUS_LABELS[input.destino] },
      ]);
    }
    case 'excluir_tarefa': {
      const task = findActive(tasks, input.id);
      if (!task) return failure('A tarefa ativa não foi encontrada. Consulte as tarefas novamente.');
      return proposal(toolName, { id: String(task.id) }, 'Excluir tarefa', 'A tarefa será enviada para a Lixeira e poderá ser restaurada.', [
        { label: 'Tarefa', value: task.title || 'Sem título' },
        { label: 'Categoria', value: task.category || 'Sem categoria' },
        { label: 'Status', value: STATUS_LABELS[task.status] || task.status || 'A fazer' },
        { label: 'Prazo', value: formatDate(task.dueDate) },
      ], {
        confirmationLevel: 'destructive',
        confirmLabel: 'Excluir tarefa',
      });
    }
    case 'criar_nota': {
      const title = cleanText(input.titulo, 180);
      const category = input.categoria;
      const content = cleanContent(input.conteudo);
      if (!title) return failure('Informe o título da nota.');
      if (!NOTE_CATEGORIES.has(category) || category === 'Compras') {
        return failure('Escolha uma categoria válida ou use criar_lista_compras para Compras.');
      }
      return proposal(toolName, { titulo: title, categoria: category, conteudo: content }, 'Criar nota', 'A nota será adicionada aos registros ativos.', [
        { label: 'Título', value: title },
        { label: 'Categoria', value: category },
        { label: 'Conteúdo', value: content || 'Sem conteúdo' },
      ]);
    }
    case 'criar_lista_compras': {
      const title = cleanText(input.titulo, 180);
      const items = cleanItems(input.itens);
      if (!title) return failure('Informe o título da lista de compras.');
      if (!items?.length) return failure('Informe ao menos um item para a lista de compras.');
      return proposal(toolName, { titulo: title, itens: items }, 'Criar lista de compras', 'Os itens serão criados desmarcados.', [
        { label: 'Título', value: title },
        { label: 'Itens', value: items.join(', ') },
      ]);
    }
    case 'editar_nota': {
      const note = findActive(notes, input.id);
      if (!note) return failure('A nota ativa não foi encontrada. Consulte as notas novamente.');
      const changes = {};
      if ('titulo' in input) {
        const title = cleanText(input.titulo, 180);
        if (!title) return failure('O título da nota não pode ficar vazio.');
        changes.titulo = title;
      }
      if ('categoria' in input) {
        if (!NOTE_CATEGORIES.has(input.categoria)) return failure('Escolha uma categoria válida para a nota.');
        changes.categoria = input.categoria;
      }
      if ('conteudo' in input) changes.conteudo = cleanContent(input.conteudo);
      if ('itens' in input) {
        const items = cleanItems(input.itens);
        if (!items?.length) return failure('Uma lista de compras deve possuir ao menos um item.');
        changes.itens = items;
      }
      if (Object.keys(changes).length === 0) return failure('Informe ao menos uma alteração para a nota.');
      const finalCategory = changes.categoria || note.category;
      if (changes.itens && finalCategory !== 'Compras') {
        return failure('Itens com caixas de seleção são permitidos somente na categoria Compras.');
      }
      if (finalCategory === 'Compras' && !changes.itens && !Array.isArray(note.items)) {
        const itemsFromContent = cleanItems(String(changes.conteudo ?? note.content ?? '').split('\n'));
        if (!itemsFromContent?.length) return failure('Informe os itens da lista de compras.');
        changes.itens = itemsFromContent;
      }
      const fields = [{ label: 'Nota', value: note.title || 'Sem título' }];
      if ('titulo' in changes) fields.push({ label: 'Novo título', value: changes.titulo });
      if ('categoria' in changes) fields.push({ label: 'Nova categoria', value: changes.categoria });
      if ('conteudo' in changes) fields.push({ label: 'Novo conteúdo', value: changes.conteudo || 'Sem conteúdo' });
      if ('itens' in changes) fields.push({ label: 'Itens', value: changes.itens.join(', ') });
      return proposal(toolName, { id: String(note.id), ...changes }, 'Editar nota', 'Somente os campos apresentados serão alterados.', fields);
    }
    case 'excluir_nota': {
      const note = findActive(notes, input.id);
      if (!note) return failure('A nota ativa não foi encontrada. Consulte as notas novamente.');
      return proposal(toolName, { id: String(note.id) }, 'Excluir nota', 'A nota será enviada para a Lixeira e poderá ser restaurada.', [
        { label: 'Nota', value: note.title || 'Sem título' },
        { label: 'Categoria', value: note.category || 'Sem categoria' },
      ], {
        confirmationLevel: 'destructive',
        confirmLabel: 'Excluir nota',
      });
    }
    case 'criar_evento': {
      const title = cleanText(input.titulo, 180);
      const date = String(input.data || '').trim();
      const time = String(input.hora || '').trim();
      const category = input.categoria;
      const reminderMinutes = parseReminder(input.lembrete_minutos);
      const syncGoogle = typeof input.sincronizar_google === 'boolean'
        ? input.sincronizar_google
        : googleCalendarConnected;
      if (!title) return failure('Informe o título do evento.');
      if (!isValidDate(date) || !date) return failure('A data do evento deve usar uma data válida no formato YYYY-MM-DD.');
      if (!isValidTime(time)) return failure('O horário do evento deve usar o formato HH:mm.');
      if (!EVENT_CATEGORIES.has(category)) return failure('Escolha uma categoria válida para o evento.');
      if (reminderMinutes == null) return failure('O lembrete deve estar entre 0 e 10080 minutos.');
      const googleLabel = syncGoogle
        ? googleCalendarConnected ? 'Sim' : 'Solicitado, mas a integração está indisponível'
        : 'Não';
      return proposal(toolName, {
        titulo: title,
        data: date,
        hora: time,
        categoria: category,
        lembrete_minutos: reminderMinutes,
        sincronizar_google: syncGoogle,
      }, 'Criar evento', 'O evento será salvo no calendário do Organizador.', [
        { label: 'Evento', value: title },
        { label: 'Data', value: formatDate(date) },
        { label: 'Horário', value: time },
        { label: 'Categoria', value: category },
        { label: 'Lembrete', value: reminderMinutes ? `${reminderMinutes} minutos antes` : 'Sem lembrete' },
        { label: 'Google Calendar', value: googleLabel },
      ]);
    }
    case 'editar_evento': {
      const event = findActive(events, input.id);
      if (!event) return failure('O evento ativo não foi encontrado. Consulte o calendário novamente.');
      const changes = {};
      if ('titulo' in input) {
        const title = cleanText(input.titulo, 180);
        if (!title) return failure('O título do evento não pode ficar vazio.');
        changes.titulo = title;
      }
      if ('data' in input) {
        const date = String(input.data || '').trim();
        if (!isValidDate(date) || !date) return failure('A data do evento deve usar uma data válida no formato YYYY-MM-DD.');
        changes.data = date;
      }
      if ('hora' in input) {
        const time = String(input.hora || '').trim();
        if (!isValidTime(time)) return failure('O horário do evento deve usar o formato HH:mm.');
        changes.hora = time;
      }
      if ('categoria' in input) {
        if (!EVENT_CATEGORIES.has(input.categoria)) return failure('Escolha uma categoria válida para o evento.');
        changes.categoria = input.categoria;
      }
      if ('lembrete_minutos' in input) {
        const reminder = parseReminder(input.lembrete_minutos);
        if (reminder == null) return failure('O lembrete deve estar entre 0 e 10080 minutos.');
        changes.lembrete_minutos = reminder;
      }
      if (Object.keys(changes).length === 0) return failure('Informe ao menos uma alteração para o evento.');
      const fields = [
        { label: 'Evento', value: event.title || 'Sem título' },
        { label: 'Data atual', value: formatDate(event.date) },
        { label: 'Horário atual', value: event.time || 'Sem horário' },
      ];
      if ('titulo' in changes) fields.push({ label: 'Novo título', value: changes.titulo });
      if ('data' in changes) fields.push({ label: 'Nova data', value: formatDate(changes.data) });
      if ('hora' in changes) fields.push({ label: 'Novo horário', value: changes.hora });
      if ('categoria' in changes) fields.push({ label: 'Nova categoria', value: changes.categoria });
      if ('lembrete_minutos' in changes) fields.push({ label: 'Novo lembrete', value: changes.lembrete_minutos ? `${changes.lembrete_minutos} minutos antes` : 'Sem lembrete' });
      if (event.googleEventId) fields.push({ label: 'Google Calendar', value: googleCalendarConnected ? 'Atualizar evento sincronizado' : 'Integração indisponível; alteração ficará local' });
      return proposal(toolName, { id: String(event.id), ...changes }, 'Editar evento', 'Somente os campos apresentados serão alterados.', fields);
    }
    case 'excluir_evento': {
      const event = findActive(events, input.id);
      if (!event) return failure('O evento ativo não foi encontrado. Consulte o calendário novamente.');
      return proposal(toolName, { id: String(event.id) }, 'Excluir evento', 'O evento será removido do Organizador e do Google Calendar quando estiver sincronizado.', [
        { label: 'Evento', value: event.title || 'Sem título' },
        { label: 'Data', value: formatDate(event.date) },
        { label: 'Horário', value: event.time || 'Sem horário' },
        { label: 'Google Calendar', value: event.googleEventId ? googleCalendarConnected ? 'Também será removido' : 'Não conectado; poderá permanecer no Google' : 'Não sincronizado' },
      ], {
        confirmationLevel: 'destructive',
        confirmLabel: 'Excluir evento',
      });
    }
    case 'criar_habito': {
      const name = cleanText(input.nome, 120);
      const frequency = input.frequencia;
      const color = input.cor || 'Verde';
      if (!name) return failure('Informe o nome do hábito.');
      if (!HABIT_FREQUENCIES.has(frequency)) return failure('Escolha uma frequência válida para o hábito.');
      if (!HABIT_COLORS.has(color)) return failure('Escolha uma cor válida para o hábito.');
      const days = frequency === 'dias_especificos' ? normalizeHabitDays(input.dias) : [];
      if (frequency === 'dias_especificos' && !days) {
        return failure('Informe ao menos um dia válido para a frequência específica.');
      }
      const recurrence = recurrenceFromFrequency(frequency, days);
      return proposal(toolName, {
        nome: name,
        frequencia: frequency,
        dias: days,
        cor: color,
      }, 'Criar hábito', 'O hábito será adicionado aos registros ativos.', [
        { label: 'Hábito', value: name },
        { label: 'Frequência', value: recurrence },
        { label: 'Cor', value: color },
      ]);
    }
    case 'editar_habito': {
      const habit = findActive(habits, input.id);
      if (!habit) return failure('O hábito ativo não foi encontrado. Consulte os hábitos novamente.');
      const currentSchedule = frequencyFromHabit(habit);
      const changes = {};
      if ('nome' in input) {
        const name = cleanText(input.nome, 120);
        if (!name) return failure('O nome do hábito não pode ficar vazio.');
        changes.nome = name;
      }
      if ('cor' in input) {
        if (!HABIT_COLORS.has(input.cor)) return failure('Escolha uma cor válida para o hábito.');
        changes.cor = input.cor;
      }
      if ('frequencia' in input && !HABIT_FREQUENCIES.has(input.frequencia)) {
        return failure('Escolha uma frequência válida para o hábito.');
      }
      const changesSchedule = 'frequencia' in input || 'dias' in input;
      if (changesSchedule) {
        const frequency = input.frequencia || currentSchedule.frequency;
        const days = frequency === 'dias_especificos'
          ? normalizeHabitDays(input.dias ?? currentSchedule.days)
          : [];
        if (frequency === 'dias_especificos' && !days) {
          return failure('Informe ao menos um dia válido para a frequência específica.');
        }
        changes.frequencia = frequency;
        changes.dias = days;
      }
      if (Object.keys(changes).length === 0) return failure('Informe ao menos uma alteração para o hábito.');
      const fields = [{ label: 'Hábito', value: habit.name || 'Sem nome' }];
      if ('nome' in changes) fields.push({ label: 'Novo nome', value: changes.nome });
      if ('frequencia' in changes) fields.push({ label: 'Nova frequência', value: recurrenceFromFrequency(changes.frequencia, changes.dias) });
      if ('cor' in changes) fields.push({ label: 'Nova cor', value: changes.cor });
      return proposal(toolName, { id: String(habit.id), ...changes }, 'Editar hábito', 'Somente os campos apresentados serão alterados.', fields);
    }
    case 'marcar_habito_do_dia': {
      const habit = findActive(habits, input.id);
      if (!habit) return failure('O hábito ativo não foi encontrado. Consulte os hábitos novamente.');
      if (typeof input.concluido !== 'boolean') return failure('Informe se o hábito deve ser marcado ou desmarcado.');
      const today = organizerDateKey(organizerData.now ? new Date(organizerData.now) : new Date());
      const stateDate = dailyHabitsState.lastDate || dailyHabitsState.currentDate;
      const completed = stateDate === today
        ? Boolean(dailyHabitsState.completed?.[habit.id])
        : false;
      if (completed === input.concluido) {
        return failure(input.concluido ? 'O hábito já está marcado como feito hoje.' : 'O hábito já está desmarcado hoje.');
      }
      return proposal(toolName, { id: String(habit.id), concluido: input.concluido }, input.concluido ? 'Marcar hábito' : 'Desmarcar hábito', 'O estado de hoje será atualizado.', [
        { label: 'Hábito', value: habit.name || 'Sem nome' },
        { label: 'Data', value: formatDate(today) },
        { label: 'Novo estado', value: input.concluido ? 'Feito' : 'Pendente' },
      ]);
    }
    case 'excluir_habito': {
      const habit = findActive(habits, input.id);
      if (!habit) return failure('O hábito ativo não foi encontrado. Consulte os hábitos novamente.');
      const schedule = frequencyFromHabit(habit);
      return proposal(toolName, { id: String(habit.id) }, 'Excluir hábito', 'O hábito será enviado para a Lixeira. O estado diário deixará de aparecer no painel.', [
        { label: 'Hábito', value: habit.name || 'Sem nome' },
        { label: 'Frequência', value: recurrenceFromFrequency(schedule.frequency, schedule.days) },
        { label: 'Cor', value: habitColorLabel(habit.color) },
      ], {
        confirmationLevel: 'destructive',
        confirmLabel: 'Excluir hábito',
      });
    }
    default:
      return failure('Ação ainda não implementada.');
  }
}
