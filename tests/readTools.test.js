import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReadOnlyTool } from '../src/services/ai/readTools.js';
import { READ_ONLY_TOOL_SCHEMAS } from '../src/services/ai/toolSchemas.js';

const organizerData = {
  events: [
    { id: 'e1', title: 'Dentista', date: '2026-08-18', time: '14:00', category: 'Saúde' },
    { id: 'e2', title: 'Reunião semanal', date: '2026-08-19', time: '09:00', category: 'Trabalho' },
    { id: 'e3', title: 'Evento apagado', date: '2026-08-19', deleted: true },
  ],
  tasks: [
    { id: 't1', title: 'Enviar relatório', category: 'Trabalho', status: 'a_fazer', dueDate: '2026-08-15' },
    { id: 't2', title: 'Curso de vídeo', category: 'Pessoal', status: 'em_curso' },
    { id: 't3', title: 'Finalizada', category: 'Trabalho', status: 'concluido' },
  ],
  notes: [
    { id: 'n1', title: 'Mercado', category: 'Compras', items: [{ id: 'i1', text: 'Café', checked: true }] },
    { id: 'n2', title: 'Ideias', category: 'Pessoal', content: 'Planejar férias de setembro' },
  ],
  habits: [
    { id: 'h1', name: 'Treino', recurrence: 'Todos os dias' },
    { id: 'h2', name: 'Estudo', recurrence: 'Seg, Qui' },
  ],
  dailyHabitsState: { lastDate: '2026-08-14', completed: { h1: true, h2: false } },
};

test('all exposed schemas are read-only lookup tools', () => {
  const names = READ_ONLY_TOOL_SCHEMAS.map(tool => tool.function.name);
  assert.deepEqual(names, [
    'listar_eventos',
    'obter_evento',
    'listar_tarefas',
    'obter_tarefa',
    'listar_notas',
    'obter_nota',
    'listar_habitos',
    'obter_habito',
  ]);
  assert.equal(names.some(name => /criar|editar|excluir|marcar/.test(name)), false);
});

test('event lookup filters by inclusive date range and excludes deleted records', () => {
  const result = executeReadOnlyTool('listar_eventos', {
    data_inicial: '2026-08-19',
    data_final: '2026-08-19',
  }, organizerData);

  assert.equal(result.ok, true);
  assert.equal(result.total_encontrado, 1);
  assert.equal(result.itens[0].titulo, 'Reunião semanal');
});

test('task lookup respects status and accent-insensitive search', () => {
  const result = executeReadOnlyTool('listar_tarefas', {
    status: 'em_curso',
    busca: 'video',
  }, organizerData);

  assert.equal(result.total_encontrado, 1);
  assert.equal(result.itens[0].id, 't2');
});

test('read tools provide deterministic formatted dates', () => {
  const taskResult = executeReadOnlyTool('obter_tarefa', { id: 't1' }, organizerData);
  const eventResult = executeReadOnlyTool('obter_evento', { id: 'e1' }, organizerData);

  assert.equal(taskResult.tarefa.prazo_formatado, '15 de agosto de 2026');
  assert.equal(eventResult.evento.data_formatada, '18 de agosto de 2026');
});

test('notes use previews in lists and full content only in get calls', () => {
  const listResult = executeReadOnlyTool('listar_notas', { categoria: 'compras' }, organizerData);
  const fullResult = executeReadOnlyTool('obter_nota', { id: 'n1' }, organizerData);

  assert.equal(listResult.itens[0].previa, '1/1 itens marcados: Café');
  assert.equal('conteudo' in listResult.itens[0], false);
  assert.deepEqual(fullResult.nota.itens, [{ id: 'i1', texto: 'Café', marcado: true }]);
});

test('habit lookup can filter by daily completion state', () => {
  const result = executeReadOnlyTool('listar_habitos', { feito_hoje: true }, organizerData);
  assert.equal(result.total_encontrado, 1);
  assert.equal(result.itens[0].nome, 'Treino');
  assert.equal(result.itens[0].data_estado, '2026-08-14');
  assert.equal(result.itens[0].frequencia, 'todos_dias');
  assert.deepEqual(result.itens[0].dias, []);
  assert.equal(result.itens[0].cor, 'Grafite');
});

test('habit lookup normalizes specific days and selected color', () => {
  const result = executeReadOnlyTool('obter_habito', { id: 'h2' }, {
    ...organizerData,
    habits: [{ id: 'h2', name: 'Estudo', recurrence: 'Seg, Qui', color: 'bg-purple-100 text-purple-900' }],
  });

  assert.equal(result.habito.frequencia, 'dias_especificos');
  assert.deepEqual(result.habito.dias, ['Seg', 'Qui']);
  assert.equal(result.habito.cor, 'Roxo');
});

test('unknown or write-like tools are rejected', () => {
  const result = executeReadOnlyTool('excluir_tarefa', { id: 't1' }, organizerData);
  assert.equal(result.ok, false);
  assert.match(result.error, /não permitida/);
});

test('invalid date filters are rejected before querying', () => {
  const result = executeReadOnlyTool('listar_eventos', { data_inicial: 'amanhã' }, organizerData);
  assert.equal(result.ok, false);
  assert.match(result.error, /YYYY-MM-DD/);
});

test('list limits mark partial results and are capped', () => {
  const tasks = Array.from({ length: 25 }, (_, index) => ({
    id: `task-${index}`,
    title: `Tarefa ${index}`,
    status: 'a_fazer',
  }));
  const result = executeReadOnlyTool('listar_tarefas', { limite: 99 }, { tasks });

  assert.equal(result.total_encontrado, 25);
  assert.equal(result.retornados, 20);
  assert.equal(result.parcial, true);
});

test('queries always use the organizer state supplied at call time', () => {
  const before = executeReadOnlyTool('listar_tarefas', { busca: 'Nova' }, { tasks: [] });
  const after = executeReadOnlyTool('listar_tarefas', { busca: 'Nova' }, {
    tasks: [{ id: 'new', title: 'Nova tarefa', status: 'a_fazer' }],
  });

  assert.equal(before.total_encontrado, 0);
  assert.equal(after.total_encontrado, 1);
  assert.equal(after.itens[0].titulo, 'Nova tarefa');
});
