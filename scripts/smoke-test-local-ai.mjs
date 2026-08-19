import {
  buildSystemContext,
  sendReadOnlyAgentMessageStream,
  sendOrganizerAgentMessageStream,
} from '../src/services/localLLMService.js';

const organizerData = {
  user: { displayName: 'Arthur' },
  now: new Date('2026-08-14T12:00:00-03:00'),
  tasks: [
    { id: 't1', title: 'Enviar relatório', category: 'Trabalho', status: 'a_fazer', dueDate: '2026-08-15' },
    { id: 't2', title: 'Tarefa finalizada', category: 'Pessoal', status: 'concluido' },
  ],
  habits: [
    { id: 'h1', name: 'Treino', recurrence: 'Todos os dias', color: 'bg-blue-100 text-blue-900' },
    { id: 'h2', name: 'Estudo', recurrence: 'Seg, Qui', color: 'bg-purple-100 text-purple-900' },
  ],
  dailyHabitsState: {
    lastDate: '2026-08-14',
    completed: { h1: true },
  },
  notes: [{ id: 'n1', title: 'Ideias de viagem', category: 'Pessoal', content: 'Pesquisar trilhas em Paraty.' }],
  events: [{ id: 'e1', title: 'Dentista', category: 'Saúde', date: '2026-08-18', time: '14:00' }],
  googleCalendarConnected: true,
};

const normalize = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const systemContext = buildSystemContext({ ...organizerData, toolsEnabled: true });
const cases = [
  {
    question: 'Quais tarefas estão pendentes?',
    expectedTools: ['listar_tarefas'],
    expectedAnyText: ['relatorio'],
    forbiddenText: ['hoje', 'amanha'],
  },
  {
    question: 'Meu hábito Treino está feito hoje?',
    expectedTools: ['listar_habitos'],
    expectedAnyText: ['feito', 'concluido'],
  },
  {
    question: 'O que tenho no calendário em 19 de agosto de 2026?',
    expectedTools: ['listar_eventos'],
    expectedAnyText: ['nao encontrei eventos', 'nenhum evento', 'nao ha eventos'],
  },
  {
    question: 'Qual é o conteúdo completo da nota Ideias de viagem?',
    expectedTools: ['listar_notas', 'obter_nota'],
    expectedAnyText: ['trilhas em paraty'],
  },
];

const requestedWriteCase = process.env.AI_SMOKE_WRITE_CASE || '';

for (const testCase of requestedWriteCase ? [] : cases) {
  const toolCalls = [];
  const answer = await sendReadOnlyAgentMessageStream({
    organizerData,
    systemContext,
    model: 'qwen3.5:4b',
    host: 'http://127.0.0.1:11434',
    messages: [{ role: 'user', content: testCase.question }],
    onToolCall: call => toolCalls.push(call),
  });
  const calledNames = toolCalls.map(call => call.name);

  const missingTools = testCase.expectedTools.filter(name => !calledNames.includes(name));
  if (missingTools.length > 0) {
    throw new Error(`Pergunta "${testCase.question}": faltaram ${missingTools.join(', ')}; recebeu ${calledNames.join(', ') || 'nenhuma ferramenta'}.`);
  }
  if (calledNames.some(name => /criar|editar|excluir|mover|marcar/.test(name))) {
    throw new Error(`Ferramenta de escrita indevida: ${calledNames.join(', ')}`);
  }
  if (/\b(?:t1|t2|h1|n1|e1)\b/i.test(answer)) {
    throw new Error(`A resposta expôs um ID interno: ${answer}`);
  }
  if (!testCase.expectedAnyText.some(text => normalize(answer).includes(text))) {
    throw new Error(`A resposta não contém nenhum resultado esperado (${testCase.expectedAnyText.join(', ')}): ${answer}`);
  }
  if (testCase.forbiddenText?.some(text => normalize(answer).includes(text))) {
    throw new Error(`A resposta adicionou uma data relativa não solicitada: ${answer}`);
  }

  console.log(`✓ ${testCase.expectedTools.join(' → ')}: ${answer.replace(/\s+/g, ' ').trim()}`);
}

const writeSystemContext = buildSystemContext({
  ...organizerData,
  toolsEnabled: true,
  writeToolsEnabled: true,
});

const assertWriteProposal = async ({ question, expectedTool, validate }) => {
  const beforeWriteRequest = structuredClone(organizerData);
  const writeCalls = [];
  const result = await sendOrganizerAgentMessageStream({
    organizerData,
    systemContext: writeSystemContext,
    model: 'qwen3.5:4b',
    host: 'http://127.0.0.1:11434',
    messages: [{ role: 'user', content: question }],
    onToolCall: call => writeCalls.push(call),
  });

  if (result.pendingAction?.toolName !== expectedTool) {
    throw new Error(`O Qwen não criou a proposta ${expectedTool}. Chamadas: ${JSON.stringify(writeCalls)}. Resposta: ${result.content || 'sem conteúdo'}`);
  }
  if (!result.pendingAction.requiresConfirmation) {
    throw new Error(`A proposta ${expectedTool} não exige confirmação.`);
  }
  validate(result.pendingAction.arguments, writeCalls.map(call => call.name));
  if (JSON.stringify(organizerData) !== JSON.stringify(beforeWriteRequest)) {
    throw new Error(`${expectedTool} alterou os dados antes da confirmação.`);
  }
  console.log(`✓ ${writeCalls.map(call => call.name).join(' → ')} → proposta validada; dados intactos.`);
};

if (!requestedWriteCase || requestedWriteCase === 'criar_tarefa') await assertWriteProposal({
  question: 'Crie uma tarefa chamada Comprar café, na categoria Pessoal, com prazo em 20 de agosto de 2026.',
  expectedTool: 'criar_tarefa',
  validate: (args) => {
    if (args.titulo !== 'Comprar café' || args.categoria !== 'Pessoal' || args.prazo !== '2026-08-20') {
      throw new Error(`Argumentos inesperados na criação de tarefa: ${JSON.stringify(args)}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'mover_tarefa') await assertWriteProposal({
  question: 'Mova a tarefa Enviar relatório para Em curso.',
  expectedTool: 'mover_tarefa',
  validate: (args, calls) => {
    if (!calls.includes('listar_tarefas') || args.id !== 't1' || args.destino !== 'em_curso') {
      throw new Error(`Movimentação sem consulta ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'criar_lista_compras') await assertWriteProposal({
  question: 'Crie uma lista de compras chamada Mercado com café e granola.',
  expectedTool: 'criar_lista_compras',
  validate: (args) => {
    const items = args.itens?.map(normalize) || [];
    if (args.titulo !== 'Mercado' || !items.includes('cafe') || !items.includes('granola')) {
      throw new Error(`Argumentos inesperados na lista de compras: ${JSON.stringify(args)}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'criar_evento') await assertWriteProposal({
  question: 'Crie um evento chamado Reunião de projeto em 25 de agosto de 2026 às 10:30, categoria Trabalho, com lembrete de 15 minutos.',
  expectedTool: 'criar_evento',
  validate: (args) => {
    if (args.titulo !== 'Reunião de projeto'
      || args.data !== '2026-08-25'
      || args.hora !== '10:30'
      || args.categoria !== 'Trabalho'
      || args.lembrete_minutos !== 15
      || args.sincronizar_google !== true) {
      throw new Error(`Argumentos inesperados na criação de evento: ${JSON.stringify(args)}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'editar_evento') await assertWriteProposal({
  question: 'Altere o evento Dentista de 18 de agosto de 2026 para 15:30.',
  expectedTool: 'editar_evento',
  validate: (args, calls) => {
    if (!calls.includes('listar_eventos') || args.id !== 'e1' || args.hora !== '15:30') {
      throw new Error(`Edição de evento sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'excluir_evento') await assertWriteProposal({
  question: 'Exclua o evento Dentista de 18 de agosto de 2026 às 14:00.',
  expectedTool: 'excluir_evento',
  validate: (args, calls) => {
    if (!calls.includes('listar_eventos') || args.id !== 'e1') {
      throw new Error(`Exclusão de evento sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'criar_habito') await assertWriteProposal({
  question: 'Crie o hábito Leitura para segunda, quarta e sexta, na cor roxa.',
  expectedTool: 'criar_habito',
  validate: (args) => {
    if (args.nome !== 'Leitura'
      || args.frequencia !== 'dias_especificos'
      || JSON.stringify(args.dias) !== JSON.stringify(['Seg', 'Qua', 'Sex'])
      || args.cor !== 'Roxo') {
      throw new Error(`Argumentos inesperados na criação de hábito: ${JSON.stringify(args)}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'editar_habito') await assertWriteProposal({
  question: 'Altere o hábito Estudo para todos os dias e para a cor azul.',
  expectedTool: 'editar_habito',
  validate: (args, calls) => {
    if (!calls.includes('listar_habitos')
      || args.id !== 'h2'
      || args.frequencia !== 'todos_dias'
      || args.cor !== 'Azul') {
      throw new Error(`Edição de hábito sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'marcar_habito_do_dia') await assertWriteProposal({
  question: 'Marque o hábito Estudo como feito hoje.',
  expectedTool: 'marcar_habito_do_dia',
  validate: (args, calls) => {
    if (!calls.includes('listar_habitos') || args.id !== 'h2' || args.concluido !== true) {
      throw new Error(`Marcação de hábito sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'desmarcar_habito_do_dia') await assertWriteProposal({
  question: 'Desmarque o hábito Treino hoje.',
  expectedTool: 'marcar_habito_do_dia',
  validate: (args, calls) => {
    if (!calls.includes('listar_habitos') || args.id !== 'h1' || args.concluido !== false) {
      throw new Error(`Desmarcação de hábito sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'excluir_habito') await assertWriteProposal({
  question: 'Exclua o hábito Estudo.',
  expectedTool: 'excluir_habito',
  validate: (args, calls) => {
    if (!calls.includes('listar_habitos') || args.id !== 'h2') {
      throw new Error(`Exclusão de hábito sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'excluir_tarefa') await assertWriteProposal({
  question: 'Exclua a tarefa Enviar relatório.',
  expectedTool: 'excluir_tarefa',
  validate: (args, calls) => {
    if (!calls.includes('listar_tarefas') || args.id !== 't1') {
      throw new Error(`Exclusão de tarefa sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});

if (!requestedWriteCase || requestedWriteCase === 'excluir_nota') await assertWriteProposal({
  question: 'Exclua a nota Ideias de viagem.',
  expectedTool: 'excluir_nota',
  validate: (args, calls) => {
    if (!calls.includes('listar_notas') || args.id !== 'n1') {
      throw new Error(`Exclusão de nota sem consulta única ou com argumentos inesperados: ${JSON.stringify({ args, calls })}`);
    }
  },
});
