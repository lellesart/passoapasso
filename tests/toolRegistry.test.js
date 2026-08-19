import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOrganizerTools } from '../src/services/ai/toolRegistry.js';

const names = tools => tools.map(tool => tool.function.name);

test('read questions do not expose write tools', () => {
  const tools = selectOrganizerTools([{ role: 'user', content: 'Quais tarefas estão pendentes?' }], { allowWrites: true });
  assert.deepEqual(names(tools), ['listar_tarefas', 'obter_tarefa']);
});

test('task write requests expose only task read and write tools', () => {
  const tools = selectOrganizerTools([{ role: 'user', content: 'Mova a tarefa Relatório para Em curso.' }], { allowWrites: true });
  assert.deepEqual(names(tools), [
    'listar_tarefas',
    'obter_tarefa',
    'criar_tarefa',
    'editar_tarefa',
    'mover_tarefa',
    'excluir_tarefa',
  ]);
});

test('shopping requests expose note tools without task writes', () => {
  const tools = selectOrganizerTools([{ role: 'user', content: 'Crie uma lista de compras com café.' }], { allowWrites: true });
  const selectedNames = names(tools);
  assert.equal(selectedNames.includes('criar_lista_compras'), true);
  assert.equal(selectedNames.includes('criar_tarefa'), false);
  assert.equal(selectedNames.includes('listar_notas'), true);
});

test('calendar and habit writes remain available in phase 5', () => {
  const tools = selectOrganizerTools([{ role: 'user', content: 'Crie um evento no calendário e um hábito.' }], { allowWrites: true });
  const selectedNames = names(tools);
  assert.equal(selectedNames.includes('criar_evento'), true);
  assert.equal(selectedNames.includes('editar_evento'), true);
  assert.equal(selectedNames.includes('criar_habito'), true);
  assert.equal(selectedNames.includes('editar_habito'), true);
  assert.equal(selectedNames.includes('marcar_habito_do_dia'), true);
  assert.equal(selectedNames.includes('excluir_habito'), true);
  assert.equal(selectedNames.includes('listar_habitos'), true);
});

test('mark habit requests expose only habit tools', () => {
  const tools = selectOrganizerTools([{ role: 'user', content: 'Marque o hábito Treino como feito hoje.' }], { allowWrites: true });
  assert.deepEqual(names(tools), [
    'listar_habitos',
    'obter_habito',
    'criar_habito',
    'editar_habito',
    'marcar_habito_do_dia',
    'excluir_habito',
  ]);
});
