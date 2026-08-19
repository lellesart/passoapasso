import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssistantPersona } from '../src/services/ai/assistantPersona.js';
import { buildOrganizerSnapshot } from '../src/services/ai/organizerContext.js';
import { buildSystemContext } from '../src/services/localLLMService.js';

test('persona uses the configured identity, date and restrained behavior', () => {
  const prompt = buildAssistantPersona({
    user: { displayName: 'Arthur' },
    now: new Date('2026-08-14T15:00:00-03:00'),
  });

  assert.match(prompt, /Ajudante do Dia/);
  assert.match(prompt, /Arthur/);
  assert.match(prompt, /2026-08-14/);
  assert.match(prompt, /somente leitura/);
  assert.doesNotMatch(prompt, /grande amigo|há muito tempo/i);
});

test('task snapshot derives pending and completed state from status', () => {
  const snapshot = buildOrganizerSnapshot({
    tasks: [
      { id: '1', title: 'Pendente', status: 'a_fazer', category: 'Trabalho' },
      { id: '2', title: 'Em andamento', status: 'em_curso', category: 'Pessoal' },
      { id: '3', title: 'Finalizada', status: 'concluido', category: 'Estudos' },
      { id: '4', title: 'Excluída', status: 'a_fazer', deleted: true },
    ],
  });

  assert.match(snapshot, /3 cadastradas; 2 pendentes; 1 concluídas/);
  assert.match(snapshot, /TAREFAS PENDENTES \(2\)/);
  assert.match(snapshot, /TAREFAS CONCLUÍDAS \(1\)/);
  assert.match(snapshot, /\[concluída\] Finalizada/);
  assert.doesNotMatch(snapshot, /Excluída/);
});

test('habit snapshot uses name, recurrence and daily completion state', () => {
  const snapshot = buildOrganizerSnapshot({
    habits: [{ id: 'h1', name: 'Treino', recurrence: 'Seg, Qui' }],
    dailyHabitsState: { lastDate: '2026-08-14', completed: { h1: true } },
  });

  assert.match(snapshot, /Treino/);
  assert.match(snapshot, /recorrência: Seg, Qui/);
  assert.match(snapshot, /estado em 2026-08-14: feito/);
  assert.doesNotMatch(snapshot, /undefined/);
});

test('calendar snapshot never includes deleted events', () => {
  const snapshot = buildOrganizerSnapshot({
    events: [
      { id: 'e1', title: 'Dentista', date: '2026-08-18', time: '14:00', category: 'Saúde' },
      { id: 'e2', title: 'Evento removido', date: '2026-08-19', deleted: true },
    ],
  });

  assert.match(snapshot, /terça-feira, 2026-08-18 às 14:00 \| Dentista/);
  assert.doesNotMatch(snapshot, /Evento removido/);
});

test('empty calendar is explicit and does not suggest invented records', () => {
  const snapshot = buildOrganizerSnapshot({ events: [] });
  assert.match(snapshot, /Nenhum evento cadastrado no calendário do Organizador/);
});

test('shopping notes expose checked item counts without losing item names', () => {
  const snapshot = buildOrganizerSnapshot({
    notes: [{
      id: 'n1',
      title: 'Mercado',
      category: 'Compras',
      items: [
        { id: 'i1', text: 'Café', checked: true },
        { id: 'i2', text: 'Granola', checked: false },
      ],
    }],
  });

  assert.match(snapshot, /1\/2 itens marcados: Café, Granola/);
});

test('tool mode embeds no record details or counts', () => {
  const context = buildSystemContext({
    toolsEnabled: true,
    tasks: [{ id: 't1', title: 'Conteúdo que deve ficar fora do resumo', status: 'a_fazer' }],
    events: [{ id: 'e1', title: 'Evento reservado', date: '2026-08-20' }],
  });

  assert.match(context, /consulte a ferramenta de leitura adequada/i);
  assert.match(context, /Nenhum registro, título, conteúdo, estado ou contagem foi incluído/);
  assert.doesNotMatch(context, /Tarefas: 1|Eventos: 1/);
  assert.doesNotMatch(context, /Conteúdo que deve ficar fora do resumo|Evento reservado/);
});

test('phase 5 persona requires explicit requests and reinforced deletion confirmation', () => {
  const context = buildSystemContext({
    toolsEnabled: true,
    writeToolsEnabled: true,
    googleCalendarConnected: true,
  });

  assert.match(context, /pedido explícito de alteração/i);
  assert.match(context, /botões Confirmar e Cancelar/i);
  assert.match(context, /criação\/edição\/exclusão de eventos/i);
  assert.match(context, /criação\/edição\/marcação\/exclusão de hábitos/i);
  assert.match(context, /excluir uma tarefa ou nota/i);
  assert.doesNotMatch(context, /não proponha excluir tarefas ou notas/i);
  assert.match(context, /desmarcar, exija que o usuário tenha pedido explicitamente/i);
  assert.match(context, /Integração Google Calendar: conectada/i);
  assert.match(context, /não diga que ela foi concluída/i);
});
