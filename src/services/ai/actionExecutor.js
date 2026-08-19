import { buildActionProposal } from './actionValidation.js';
import {
  HABIT_COLOR_VALUES,
  organizerDateKey,
  recurrenceFromFrequency,
} from './habitModel.js';

const createShoppingItems = (items, noteId) => items.map((text, index) => ({
  id: `${noteId}-${index}`,
  text,
  checked: false,
}));

const clone = value => structuredClone(value);

const success = (collection, records, message, record, options = {}) => ({
  ok: true,
  collection,
  records,
  message,
  record,
  ...options,
});

export function applyConfirmedOrganizerAction(proposal, organizerData = {}, createId = () => Date.now().toString()) {
  if (!proposal?.requiresConfirmation) {
    return { ok: false, error: 'A ação não possui uma confirmação válida.' };
  }

  const validation = buildActionProposal(proposal.toolName, proposal.arguments, organizerData);
  if (!validation.ok) return validation;

  const args = validation.proposal.arguments;
  const tasks = organizerData.tasks || [];
  const notes = organizerData.notes || [];
  const events = organizerData.events || [];
  const habits = organizerData.habits || [];
  const dailyHabitsState = organizerData.dailyHabitsState || {};

  switch (proposal.toolName) {
    case 'criar_tarefa': {
      const task = {
        id: createId(),
        title: args.titulo,
        category: args.categoria,
        priority: 'Média',
        status: 'a_fazer',
        dueDate: args.prazo || null,
      };
      return success('tasks', [...tasks, task], 'Tarefa criada com sucesso.', task, {
        undo: { type: 'remove-created', collection: 'tasks', id: String(task.id), sourceToolName: proposal.toolName },
      });
    }
    case 'editar_tarefa': {
      let updatedTask = null;
      const records = tasks.map(task => {
        if (String(task.id) !== args.id) return task;
        updatedTask = {
          ...task,
          ...('titulo' in args ? { title: args.titulo } : {}),
          ...('categoria' in args ? { category: args.categoria } : {}),
          ...('prazo' in args ? { dueDate: args.prazo || null } : {}),
        };
        return updatedTask;
      });
      return success('tasks', records, 'Tarefa atualizada com sucesso.', updatedTask, {
        undo: { type: 'restore-record', collection: 'tasks', beforeRecord: clone(tasks.find(task => String(task.id) === args.id)), sourceToolName: proposal.toolName },
      });
    }
    case 'mover_tarefa': {
      let updatedTask = null;
      const records = tasks.map(task => {
        if (String(task.id) !== args.id) return task;
        updatedTask = { ...task, status: args.destino };
        return updatedTask;
      });
      return success('tasks', records, 'Tarefa movida com sucesso.', updatedTask, {
        undo: { type: 'restore-record', collection: 'tasks', beforeRecord: clone(tasks.find(task => String(task.id) === args.id)), sourceToolName: proposal.toolName },
      });
    }
    case 'excluir_tarefa': {
      const beforeRecord = tasks.find(task => String(task.id) === args.id);
      let deletedTask = null;
      const records = tasks.map(task => {
        if (String(task.id) !== args.id) return task;
        deletedTask = { ...task, deleted: true };
        return deletedTask;
      });
      return success('tasks', records, 'Tarefa movida para a Lixeira.', deletedTask, {
        undo: { type: 'restore-record', collection: 'tasks', beforeRecord: clone(beforeRecord), sourceToolName: proposal.toolName },
      });
    }
    case 'criar_nota': {
      const note = {
        id: createId(),
        title: args.titulo,
        category: args.categoria,
        content: args.conteudo,
      };
      return success('notes', [note, ...notes], 'Nota criada com sucesso.', note, {
        undo: { type: 'remove-created', collection: 'notes', id: String(note.id), sourceToolName: proposal.toolName },
      });
    }
    case 'criar_lista_compras': {
      const noteId = createId();
      const items = createShoppingItems(args.itens, noteId);
      const note = {
        id: noteId,
        title: args.titulo,
        category: 'Compras',
        content: items.map(item => item.text).join('\n'),
        items,
      };
      return success('notes', [note, ...notes], 'Lista de compras criada com sucesso.', note, {
        undo: { type: 'remove-created', collection: 'notes', id: String(note.id), sourceToolName: proposal.toolName },
      });
    }
    case 'editar_nota': {
      let updatedNote = null;
      const records = notes.map(note => {
        if (String(note.id) !== args.id) return note;
        const category = args.categoria || note.category;
        const rawItems = 'itens' in args
          ? createShoppingItems(args.itens, String(note.id))
          : note.items;
        updatedNote = {
          ...note,
          ...('titulo' in args ? { title: args.titulo } : {}),
          ...('categoria' in args ? { category } : {}),
          ...('conteudo' in args ? { content: args.conteudo } : {}),
          ...(category === 'Compras' && rawItems
            ? { items: rawItems, content: rawItems.map(item => item.text).join('\n') }
            : {}),
        };
        if (category !== 'Compras') delete updatedNote.items;
        return updatedNote;
      });
      return success('notes', records, updatedNote?.category === 'Compras' ? 'Lista atualizada com sucesso.' : 'Nota atualizada com sucesso.', updatedNote, {
        undo: { type: 'restore-record', collection: 'notes', beforeRecord: clone(notes.find(note => String(note.id) === args.id)), sourceToolName: proposal.toolName },
      });
    }
    case 'excluir_nota': {
      const beforeRecord = notes.find(note => String(note.id) === args.id);
      let deletedNote = null;
      const records = notes.map(note => {
        if (String(note.id) !== args.id) return note;
        deletedNote = { ...note, deleted: true };
        return deletedNote;
      });
      return success('notes', records, 'Nota movida para a Lixeira.', deletedNote, {
        undo: { type: 'restore-record', collection: 'notes', beforeRecord: clone(beforeRecord), sourceToolName: proposal.toolName },
      });
    }
    case 'criar_evento': {
      const event = {
        id: createId(),
        title: args.titulo,
        date: args.data,
        time: args.hora,
        category: args.categoria,
        reminderMinutes: args.lembrete_minutos,
      };
      return success('events', [...events, event], 'Evento criado com sucesso.', event, {
        undo: { type: 'remove-created', collection: 'events', id: String(event.id), sourceToolName: proposal.toolName },
        externalOperation: args.sincronizar_google
          ? { type: 'google-create', eventId: String(event.id) }
          : null,
      });
    }
    case 'editar_evento': {
      let previousEvent = null;
      let updatedEvent = null;
      const records = events.map(event => {
        if (String(event.id) !== args.id) return event;
        previousEvent = event;
        updatedEvent = {
          ...event,
          ...('titulo' in args ? { title: args.titulo } : {}),
          ...('data' in args ? { date: args.data } : {}),
          ...('hora' in args ? { time: args.hora } : {}),
          ...('categoria' in args ? { category: args.categoria } : {}),
          ...('lembrete_minutos' in args ? { reminderMinutes: args.lembrete_minutos } : {}),
        };
        return updatedEvent;
      });
      return success('events', records, 'Evento atualizado com sucesso.', updatedEvent, {
        undo: { type: 'restore-record', collection: 'events', beforeRecord: clone(previousEvent), sourceToolName: proposal.toolName },
        externalOperation: previousEvent?.googleEventId
          ? { type: 'google-update', eventId: args.id, googleEventId: previousEvent.googleEventId }
          : null,
      });
    }
    case 'excluir_evento': {
      let deletedEvent = null;
      const records = events.map(event => {
        if (String(event.id) !== args.id) return event;
        deletedEvent = { ...event, deleted: true };
        return deletedEvent;
      });
      return success('events', records, 'Evento movido para a Lixeira.', deletedEvent, {
        undo: { type: 'restore-record', collection: 'events', beforeRecord: clone(events.find(event => String(event.id) === args.id)), sourceToolName: proposal.toolName },
        externalOperation: deletedEvent?.googleEventId
          ? { type: 'google-delete', eventId: args.id, googleEventId: deletedEvent.googleEventId }
          : null,
      });
    }
    case 'criar_habito': {
      const habit = {
        id: createId(),
        name: args.nome,
        color: HABIT_COLOR_VALUES[args.cor],
        recurrence: recurrenceFromFrequency(args.frequencia, args.dias),
        frequency: args.frequencia,
        days: args.dias,
        iconName: 'Activity',
      };
      return success('habits', [habit, ...habits], 'Hábito criado com sucesso.', habit, {
        undo: { type: 'remove-created', collection: 'habits', id: String(habit.id), sourceToolName: proposal.toolName },
      });
    }
    case 'editar_habito': {
      let updatedHabit = null;
      const records = habits.map(habit => {
        if (String(habit.id) !== args.id) return habit;
        updatedHabit = {
          ...habit,
          ...('nome' in args ? { name: args.nome } : {}),
          ...('cor' in args ? { color: HABIT_COLOR_VALUES[args.cor] } : {}),
          ...('frequencia' in args ? {
            frequency: args.frequencia,
            days: args.dias,
            recurrence: recurrenceFromFrequency(args.frequencia, args.dias),
          } : {}),
        };
        return updatedHabit;
      });
      return success('habits', records, 'Hábito atualizado com sucesso.', updatedHabit, {
        undo: { type: 'restore-record', collection: 'habits', beforeRecord: clone(habits.find(habit => String(habit.id) === args.id)), sourceToolName: proposal.toolName },
      });
    }
    case 'marcar_habito_do_dia': {
      const today = organizerDateKey(organizerData.now ? new Date(organizerData.now) : new Date());
      const stateDate = dailyHabitsState.lastDate || dailyHabitsState.currentDate;
      const completed = stateDate === today
        ? { ...(dailyHabitsState.completed || {}) }
        : {};
      completed[args.id] = args.concluido;
      const state = { lastDate: today, completed };
      const habit = habits.find(item => String(item.id) === args.id);
      return success(
        'dailyHabitsState',
        state,
        args.concluido ? 'Hábito marcado como feito hoje.' : 'Hábito desmarcado hoje.',
        habit,
        {
          undo: {
            type: 'restore-daily-habit',
            collection: 'dailyHabitsState',
            habitId: args.id,
            date: today,
            hadValue: stateDate === today && Object.prototype.hasOwnProperty.call(dailyHabitsState.completed || {}, args.id),
            previousValue: Boolean(dailyHabitsState.completed?.[args.id]),
            sourceToolName: proposal.toolName,
          },
        },
      );
    }
    case 'excluir_habito': {
      let deletedHabit = null;
      const records = habits.map(habit => {
        if (String(habit.id) !== args.id) return habit;
        deletedHabit = { ...habit, deleted: true };
        return deletedHabit;
      });
      return success('habits', records, 'Hábito movido para a Lixeira.', deletedHabit, {
        undo: { type: 'restore-record', collection: 'habits', beforeRecord: clone(habits.find(habit => String(habit.id) === args.id)), sourceToolName: proposal.toolName },
      });
    }
    default:
      return { ok: false, error: 'Ação não implementada no executor.' };
  }
}

export function applyOrganizerUndo(undo, organizerData = {}) {
  if (!undo || !['remove-created', 'restore-record', 'restore-daily-habit'].includes(undo.type)) {
    return { ok: false, error: 'A ação de desfazer não é válida ou expirou.' };
  }

  if (undo.type === 'restore-daily-habit') {
    const today = organizerDateKey(organizerData.now ? new Date(organizerData.now) : new Date());
    if (today !== undo.date) return { ok: false, error: 'Não é possível desfazer um check diário de outro dia.' };
    const current = organizerData.dailyHabitsState || {};
    const completed = (current.lastDate || current.currentDate) === today
      ? { ...(current.completed || {}) }
      : {};
    if (undo.hadValue) completed[undo.habitId] = undo.previousValue;
    else delete completed[undo.habitId];
    return success('dailyHabitsState', { lastDate: today, completed }, 'Alteração do hábito desfeita.', null);
  }

  const records = organizerData[undo.collection];
  if (!Array.isArray(records)) return { ok: false, error: 'A coleção original não está disponível para desfazer.' };

  if (undo.type === 'remove-created') {
    const currentRecord = records.find(record => String(record.id) === String(undo.id));
    if (!currentRecord) return { ok: false, error: 'O registro criado não existe mais.' };
    const restoredRecords = records.filter(record => String(record.id) !== String(undo.id));
    return success(undo.collection, restoredRecords, 'Criação desfeita.', null, {
      externalOperation: undo.collection === 'events' && currentRecord.googleEventId
        ? { type: 'google-delete', eventId: String(currentRecord.id), googleEventId: currentRecord.googleEventId }
        : null,
    });
  }

  const beforeRecord = clone(undo.beforeRecord);
  const index = records.findIndex(record => String(record.id) === String(beforeRecord.id));
  if (index < 0) return { ok: false, error: 'O registro alterado não existe mais.' };
  let recordToRestore = beforeRecord;
  let externalOperation = null;

  if (undo.collection === 'events' && undo.googleOperationSucceeded) {
    if (undo.sourceToolName === 'excluir_evento' && beforeRecord.googleEventId) {
      recordToRestore = { ...beforeRecord };
      delete recordToRestore.googleEventId;
      externalOperation = { type: 'google-create', eventId: String(beforeRecord.id) };
    } else if (undo.sourceToolName === 'editar_evento' && beforeRecord.googleEventId) {
      externalOperation = { type: 'google-update', eventId: String(beforeRecord.id), googleEventId: beforeRecord.googleEventId };
    }
  }

  const restoredRecords = records.map((record, recordIndex) => recordIndex === index ? recordToRestore : record);
  return success(undo.collection, restoredRecords, 'Alteração desfeita.', recordToRestore, { externalOperation });
}
