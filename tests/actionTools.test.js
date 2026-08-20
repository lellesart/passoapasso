import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActionProposal } from '../src/services/ai/actionValidation.js';
import { applyConfirmedOrganizerAction, applyOrganizerUndo } from '../src/services/ai/actionExecutor.js';
import { WRITE_TOOL_SCHEMAS } from '../src/services/ai/toolSchemas.js';

const organizerData = {
  tasks: [
    { id: 't1', title: 'Enviar relatório', category: 'Trabalho', status: 'a_fazer', dueDate: null },
  ],
  notes: [
    { id: 'n1', title: 'Ideias', category: 'Pessoal', content: 'Texto antigo' },
  ],
  events: [
    { id: 'e1', title: 'Dentista', category: 'Saúde', date: '2026-08-20', time: '14:00', reminderMinutes: 30, googleEventId: 'google-1' },
  ],
  habits: [
    { id: 'h1', name: 'Treino', color: 'bg-blue-100 text-blue-900', recurrence: 'Todos os dias' },
  ],
  dailyHabitsState: { lastDate: '2026-08-15', completed: { h1: false } },
  now: new Date('2026-08-15T12:00:00-03:00'),
  googleCalendarConnected: true,
};

test('phase 5 exposes task, note, calendar and habit writes with logical deletion', () => {
  const names = WRITE_TOOL_SCHEMAS.map(tool => tool.function.name);
  assert.deepEqual(names, [
    'criar_tarefa',
    'editar_tarefa',
    'mover_tarefa',
    'excluir_tarefa',
    'criar_nota',
    'editar_nota',
    'criar_lista_compras',
    'excluir_nota',
    'criar_evento',
    'editar_evento',
    'excluir_evento',
    'criar_habito',
    'editar_habito',
    'marcar_habito_do_dia',
    'excluir_habito',
  ]);
  assert.deepEqual(names.filter(name => name.startsWith('excluir_')), ['excluir_tarefa', 'excluir_nota', 'excluir_evento', 'excluir_habito']);
});

test('building a proposal never mutates organizer data', () => {
  const before = structuredClone(organizerData);
  const result = buildActionProposal('criar_tarefa', {
    titulo: 'Comprar café',
    categoria: 'Pessoal',
  }, organizerData);

  assert.equal(result.ok, true);
  assert.equal(result.proposal.requiresConfirmation, true);
  assert.deepEqual(organizerData, before);
});

test('confirmed task creation uses organizer record shape', () => {
  const proposalResult = buildActionProposal('criar_tarefa', {
    titulo: 'Comprar café',
    categoria: 'Pessoal',
    prazo: '2026-08-20',
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData, () => 'new-task');

  assert.equal(result.ok, true);
  assert.equal(result.collection, 'tasks');
  assert.deepEqual(result.record, {
    id: 'new-task',
    title: 'Comprar café',
    category: 'Pessoal',
    priority: 'Média',
    status: 'a_fazer',
    dueDate: '2026-08-20',
  });
  assert.equal(organizerData.tasks.length, 1);
});

test('task editing and movement are revalidated against current state', () => {
  const edit = buildActionProposal('editar_tarefa', { id: 't1', titulo: 'Enviar relatório final' }, organizerData);
  const edited = applyConfirmedOrganizerAction(edit.proposal, organizerData);
  const move = buildActionProposal('mover_tarefa', { id: 't1', destino: 'em_curso' }, organizerData);
  const moved = applyConfirmedOrganizerAction(move.proposal, organizerData);

  assert.equal(edited.record.title, 'Enviar relatório final');
  assert.equal(moved.record.status, 'em_curso');

  const stale = applyConfirmedOrganizerAction(edit.proposal, { ...organizerData, tasks: [] });
  assert.equal(stale.ok, false);
  assert.match(stale.error, /não foi encontrada/);
});

test('shopping list creation produces checkable organizer items', () => {
  const proposalResult = buildActionProposal('criar_lista_compras', {
    titulo: 'Mercado',
    itens: ['Café', 'Granola'],
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData, () => 'shopping');

  assert.equal(result.record.category, 'Compras');
  assert.equal(result.record.content, 'Café\nGranola');
  assert.deepEqual(result.record.items, [
    { id: 'shopping-0', text: 'Café', checked: false },
    { id: 'shopping-1', text: 'Granola', checked: false },
  ]);
});

test('note editing changes only validated fields', () => {
  const proposalResult = buildActionProposal('editar_nota', {
    id: 'n1',
    titulo: 'Ideias revisadas',
    conteudo: 'Texto novo',
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData);

  assert.equal(result.record.title, 'Ideias revisadas');
  assert.equal(result.record.content, 'Texto novo');
  assert.equal(result.record.category, 'Pessoal');
});

test('editing a shopping list title preserves item completion state', () => {
  const data = {
    tasks: [],
    notes: [{
      id: 'shopping',
      title: 'Mercado',
      category: 'Compras',
      content: 'Café',
      items: [{ id: 'shopping-0', text: 'Café', checked: true }],
    }],
  };
  const proposalResult = buildActionProposal('editar_nota', { id: 'shopping', titulo: 'Mercado semanal' }, data);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, data);

  assert.equal(result.record.title, 'Mercado semanal');
  assert.deepEqual(result.record.items, [{ id: 'shopping-0', text: 'Café', checked: true }]);
});

test('invalid dates, categories, empty edits and unconfirmed calls are blocked', () => {
  assert.equal(buildActionProposal('criar_tarefa', {
    titulo: 'Teste', categoria: 'Inválida', prazo: 'amanhã',
  }, organizerData).ok, false);
  assert.equal(buildActionProposal('editar_tarefa', { id: 't1' }, organizerData).ok, false);
  assert.equal(buildActionProposal('excluir_lista', { id: 't1' }, organizerData).ok, false);
  assert.equal(applyConfirmedOrganizerAction({
    toolName: 'criar_tarefa',
    arguments: { titulo: 'Teste', categoria: 'Pessoal' },
  }, organizerData).ok, false);
});

test('event creation validates date, time, reminder and Google preference', () => {
  const result = buildActionProposal('criar_evento', {
    titulo: 'Consulta',
    data: '2026-08-22',
    hora: '09:30',
    categoria: 'Saúde',
    lembrete_minutos: 30,
  }, organizerData);

  assert.equal(result.ok, true);
  assert.equal(result.proposal.arguments.sincronizar_google, true);
  assert.match(result.proposal.displayFields.find(field => field.label === 'Data').value, /22 de agosto de 2026/);

  assert.equal(buildActionProposal('criar_evento', {
    titulo: 'Inválido', data: '2026-02-30', hora: '25:00', categoria: 'Saúde',
  }, organizerData).ok, false);
});

test('confirmed event creation, editing and deletion produce external operations', () => {
  const createProposal = buildActionProposal('criar_evento', {
    titulo: 'Consulta', data: '2026-08-22', hora: '09:30', categoria: 'Saúde', sincronizar_google: true,
  }, organizerData);
  const created = applyConfirmedOrganizerAction(createProposal.proposal, organizerData, () => 'new-event');
  assert.equal(created.record.id, 'new-event');
  assert.equal(created.externalOperation.type, 'google-create');

  const editProposal = buildActionProposal('editar_evento', { id: 'e1', hora: '15:00' }, organizerData);
  const edited = applyConfirmedOrganizerAction(editProposal.proposal, organizerData);
  assert.equal(edited.record.time, '15:00');
  assert.deepEqual(edited.externalOperation, { type: 'google-update', eventId: 'e1', googleEventId: 'google-1' });

  const deleteProposal = buildActionProposal('excluir_evento', { id: 'e1' }, organizerData);
  const deleted = applyConfirmedOrganizerAction(deleteProposal.proposal, organizerData);
  assert.equal(deleteProposal.proposal.confirmationLevel, 'destructive');
  assert.equal(deleted.record.deleted, true);
  assert.deepEqual(deleted.externalOperation, { type: 'google-delete', eventId: 'e1', googleEventId: 'google-1' });
});

test('habit creation uses the same recurrence and color shape as the interface', () => {
  const proposalResult = buildActionProposal('criar_habito', {
    nome: 'Leitura',
    frequencia: 'dias_especificos',
    dias: ['Sex', 'Seg', 'Sex'],
    cor: 'Roxo',
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData, () => 'new-habit');

  assert.equal(result.collection, 'habits');
  assert.deepEqual(result.record, {
    id: 'new-habit',
    name: 'Leitura',
    color: 'habit-color-purple',
    recurrence: 'Seg, Sex',
    frequency: 'dias_especificos',
    days: ['Seg', 'Sex'],
    iconName: 'Activity',
  });
});

test('habit editing updates only requested fields and normalizes recurrence', () => {
  const proposalResult = buildActionProposal('editar_habito', {
    id: 'h1',
    frequencia: 'dias_especificos',
    dias: ['Qua', 'Sáb'],
    cor: 'Verde',
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData);

  assert.equal(result.record.name, 'Treino');
  assert.equal(result.record.recurrence, 'Qua, Sáb');
  assert.equal(result.record.color, 'habit-color-green');
});

test('daily habit marking is explicit, date-bound and revalidated', () => {
  const proposalResult = buildActionProposal('marcar_habito_do_dia', {
    id: 'h1',
    concluido: true,
  }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData);

  assert.equal(result.collection, 'dailyHabitsState');
  assert.deepEqual(result.records, { lastDate: '2026-08-15', completed: { h1: true } });
  assert.equal(organizerData.dailyHabitsState.completed.h1, false);

  const alreadyDone = buildActionProposal('marcar_habito_do_dia', {
    id: 'h1', concluido: true,
  }, { ...organizerData, dailyHabitsState: result.records });
  assert.equal(alreadyDone.ok, false);
  assert.match(alreadyDone.error, /já está marcado/i);
});

test('habit deletion uses reinforced confirmation and moves it to trash', () => {
  const proposalResult = buildActionProposal('excluir_habito', { id: 'h1' }, organizerData);
  const result = applyConfirmedOrganizerAction(proposalResult.proposal, organizerData);

  assert.equal(proposalResult.proposal.confirmationLevel, 'destructive');
  assert.equal(proposalResult.proposal.confirmLabel, 'Excluir hábito');
  assert.equal(result.record.deleted, true);
  assert.equal(organizerData.habits[0].deleted, undefined);
});

test('habit validation rejects missing days, invalid colors and implicit state', () => {
  assert.equal(buildActionProposal('criar_habito', {
    nome: 'Leitura', frequencia: 'dias_especificos', cor: 'Roxo',
  }, organizerData).ok, false);
  assert.equal(buildActionProposal('criar_habito', {
    nome: 'Leitura', frequencia: 'todos_dias', cor: 'Turquesa',
  }, organizerData).ok, false);
  assert.equal(buildActionProposal('marcar_habito_do_dia', { id: 'h1' }, organizerData).ok, false);
});

test('task and note deletion are reinforced, logical and individually undoable', () => {
  const taskProposal = buildActionProposal('excluir_tarefa', { id: 't1' }, organizerData);
  const deletedTask = applyConfirmedOrganizerAction(taskProposal.proposal, organizerData);
  assert.equal(taskProposal.proposal.confirmationLevel, 'destructive');
  assert.equal(deletedTask.record.deleted, true);
  const restoredTask = applyOrganizerUndo(deletedTask.undo, { ...organizerData, tasks: deletedTask.records });
  assert.equal(restoredTask.record.deleted, undefined);

  const noteProposal = buildActionProposal('excluir_nota', { id: 'n1' }, organizerData);
  const deletedNote = applyConfirmedOrganizerAction(noteProposal.proposal, organizerData);
  assert.equal(noteProposal.proposal.confirmLabel, 'Excluir nota');
  assert.equal(deletedNote.record.deleted, true);
  const restoredNote = applyOrganizerUndo(deletedNote.undo, { ...organizerData, notes: deletedNote.records });
  assert.equal(restoredNote.record.content, 'Texto antigo');
});

test('undo removes only a newly created record and preserves later records', () => {
  const proposal = buildActionProposal('criar_tarefa', { titulo: 'Nova', categoria: 'Pessoal' }, organizerData);
  const created = applyConfirmedOrganizerAction(proposal.proposal, organizerData, () => 'new-task');
  const laterTask = { id: 'later', title: 'Criada depois', category: 'Pessoal', status: 'a_fazer' };
  const undone = applyOrganizerUndo(created.undo, {
    ...organizerData,
    tasks: [...created.records, laterTask],
  });

  assert.equal(undone.records.some(task => task.id === 'new-task'), false);
  assert.equal(undone.records.some(task => task.id === 'later'), true);
  assert.equal(undone.records.some(task => task.id === 't1'), true);
});

test('undo restores only the targeted daily habit state', () => {
  const proposal = buildActionProposal('marcar_habito_do_dia', { id: 'h1', concluido: true }, organizerData);
  const marked = applyConfirmedOrganizerAction(proposal.proposal, organizerData);
  const undone = applyOrganizerUndo(marked.undo, {
    ...organizerData,
    dailyHabitsState: { ...marked.records, completed: { ...marked.records.completed, h2: true } },
  });

  assert.equal(undone.records.completed.h1, false);
  assert.equal(undone.records.completed.h2, true);
});

test('event undo produces the inverse Google operation only when needed', () => {
  const createProposal = buildActionProposal('criar_evento', {
    titulo: 'Consulta', data: '2026-08-22', hora: '09:30', categoria: 'Saúde', sincronizar_google: true,
  }, organizerData);
  const created = applyConfirmedOrganizerAction(createProposal.proposal, organizerData, () => 'new-event');
  const undoCreate = applyOrganizerUndo(created.undo, {
    ...organizerData,
    events: [...created.records.filter(event => event.id !== 'new-event'), { ...created.record, googleEventId: 'google-new' }],
  });
  assert.deepEqual(undoCreate.externalOperation, {
    type: 'google-delete', eventId: 'new-event', googleEventId: 'google-new',
  });

  const deleteProposal = buildActionProposal('excluir_evento', { id: 'e1' }, organizerData);
  const deleted = applyConfirmedOrganizerAction(deleteProposal.proposal, organizerData);
  const undoDelete = applyOrganizerUndo({ ...deleted.undo, googleOperationSucceeded: true }, {
    ...organizerData,
    events: deleted.records,
  });
  assert.equal(undoDelete.record.googleEventId, undefined);
  assert.deepEqual(undoDelete.externalOperation, { type: 'google-create', eventId: 'e1' });

  const undoLocalDelete = applyOrganizerUndo({ ...deleted.undo, googleOperationSucceeded: false }, {
    ...organizerData,
    events: deleted.records,
  });
  assert.equal(undoLocalDelete.record.googleEventId, 'google-1');
  assert.equal(undoLocalDelete.externalOperation, null);
});
