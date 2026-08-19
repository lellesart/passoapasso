import test from 'node:test';
import assert from 'node:assert/strict';
import { sendOrganizerAgentMessageStream } from '../src/services/localLLMService.js';

const streamResponse = message => new Response(`${JSON.stringify({ message, done: true })}\n`, {
  status: 200,
  headers: { 'Content-Type': 'application/x-ndjson' },
});

test('write tool calls return a proposal without executing organizer changes', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = { tasks: [], notes: [] };
  globalThis.fetch = async () => streamResponse({
    role: 'assistant',
    content: '',
    tool_calls: [{
      function: {
        name: 'criar_tarefa',
        arguments: { titulo: 'Comprar café', categoria: 'Pessoal' },
      },
    }],
  });

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Crie a tarefa Comprar café.' }],
      organizerData,
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction.toolName, 'criar_tarefa');
    assert.equal(result.pendingAction.requiresConfirmation, true);
    assert.deepEqual(organizerData, { tasks: [], notes: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('agent can read a record before proposing an edit', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    tasks: [{ id: 't1', title: 'Relatório', category: 'Trabalho', status: 'a_fazer' }],
    notes: [],
  };
  const responses = [
    streamResponse({
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'listar_tarefas', arguments: { busca: 'Relatório' } } }],
    }),
    streamResponse({
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'editar_tarefa', arguments: { id: 't1', titulo: 'Relatório final' } } }],
    }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const calls = [];
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Renomeie Relatório para Relatório final.' }],
      organizerData,
      systemContext: 'Teste',
      onToolCall: call => calls.push(call.name),
    });

    assert.deepEqual(calls, ['listar_tarefas', 'editar_tarefa']);
    assert.equal(result.pendingAction.arguments.id, 't1');
    assert.equal(result.pendingAction.arguments.titulo, 'Relatório final');
    assert.equal(organizerData.tasks[0].title, 'Relatório');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid write arguments are returned to the model instead of becoming a proposal', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    streamResponse({
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'criar_tarefa', arguments: { titulo: '', categoria: 'Pessoal' } } }],
    }),
    streamResponse({ role: 'assistant', content: 'Qual título você quer usar?' }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Crie uma tarefa.' }],
      organizerData: { tasks: [], notes: [] },
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction, null);
    assert.equal(result.content, 'Qual título você quer usar?');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ambiguous event deletion is rejected before confirmation', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    events: [
      { id: 'e1', title: 'Dentista', date: '2026-08-20', time: '10:00', category: 'Saúde' },
      { id: 'e2', title: 'Dentista', date: '2026-08-21', time: '11:00', category: 'Saúde' },
    ],
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_eventos', arguments: { busca: 'Dentista' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'excluir_evento', arguments: { id: 'e1' } } }],
    }),
    streamResponse({ role: 'assistant', content: 'Encontrei dois eventos. Qual data você quer excluir?' }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Exclua o evento Dentista.' }],
      organizerData,
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction, null);
    assert.match(result.content, /dois eventos/i);
    assert.equal(organizerData.events.some(event => event.deleted), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a unique event lookup can become a reinforced deletion proposal', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    events: [{ id: 'e1', title: 'Dentista', date: '2026-08-20', time: '10:00', category: 'Saúde' }],
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_eventos', arguments: { busca: 'Dentista', data_inicial: '2026-08-20', data_final: '2026-08-20' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'excluir_evento', arguments: { id: 'e1' } } }],
    }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Exclua o evento Dentista de 20 de agosto.' }],
      organizerData,
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction.toolName, 'excluir_evento');
    assert.equal(result.pendingAction.confirmationLevel, 'destructive');
    assert.equal(organizerData.events[0].deleted, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ambiguous habits cannot be marked by choosing an arbitrary ID', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    habits: [
      { id: 'h1', name: 'Treino de força', recurrence: 'Seg, Qui' },
      { id: 'h2', name: 'Treino de corrida', recurrence: 'Ter, Sex' },
    ],
    dailyHabitsState: { lastDate: '2026-08-15', completed: {} },
    now: new Date('2026-08-15T12:00:00-03:00'),
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_habitos', arguments: { busca: 'Treino' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'marcar_habito_do_dia', arguments: { id: 'h1', concluido: true } } }],
    }),
    streamResponse({ role: 'assistant', content: 'Encontrei dois hábitos de treino. Qual deles você quer marcar?' }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Marque o hábito de treino como feito hoje.' }],
      organizerData,
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction, null);
    assert.match(result.content, /dois hábitos/i);
    assert.deepEqual(organizerData.dailyHabitsState.completed, {});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a unique habit lookup can become a daily marking proposal', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    habits: [{ id: 'h1', name: 'Treino', recurrence: 'Todos os dias' }],
    dailyHabitsState: { lastDate: '2026-08-15', completed: { h1: false } },
    now: new Date('2026-08-15T12:00:00-03:00'),
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_habitos', arguments: { busca: 'Treino' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'marcar_habito_do_dia', arguments: { id: 'h1', concluido: true } } }],
    }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Marque o hábito Treino como feito hoje.' }],
      organizerData,
      systemContext: 'Teste',
    });

    assert.equal(result.pendingAction.toolName, 'marcar_habito_do_dia');
    assert.equal(result.pendingAction.arguments.concluido, true);
    assert.equal(organizerData.dailyHabitsState.completed.h1, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ambiguous task deletion is rejected before confirmation', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    tasks: [
      { id: 't1', title: 'Enviar relatório mensal', category: 'Trabalho', status: 'a_fazer' },
      { id: 't2', title: 'Enviar relatório anual', category: 'Trabalho', status: 'a_fazer' },
    ],
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_tarefas', arguments: { busca: 'Enviar relatório' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'excluir_tarefa', arguments: { id: 't1' } } }],
    }),
    streamResponse({ role: 'assistant', content: 'Encontrei duas tarefas. Qual relatório você quer excluir?' }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Exclua a tarefa de enviar relatório.' }],
      organizerData,
      systemContext: 'Teste',
    });
    assert.equal(result.pendingAction, null);
    assert.match(result.content, /duas tarefas/i);
    assert.equal(organizerData.tasks.some(task => task.deleted), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a unique note lookup can become a reinforced deletion proposal', async () => {
  const originalFetch = globalThis.fetch;
  const organizerData = {
    notes: [{ id: 'n1', title: 'Ideias de viagem', category: 'Pessoal', content: 'Paraty' }],
  };
  const responses = [
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'listar_notas', arguments: { busca: 'Ideias de viagem' } } }],
    }),
    streamResponse({
      role: 'assistant', content: '',
      tool_calls: [{ function: { name: 'excluir_nota', arguments: { id: 'n1' } } }],
    }),
  ];
  globalThis.fetch = async () => responses.shift();

  try {
    const result = await sendOrganizerAgentMessageStream({
      messages: [{ role: 'user', content: 'Exclua a nota Ideias de viagem.' }],
      organizerData,
      systemContext: 'Teste',
    });
    assert.equal(result.pendingAction.toolName, 'excluir_nota');
    assert.equal(result.pendingAction.confirmationLevel, 'destructive');
    assert.equal(organizerData.notes[0].deleted, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
