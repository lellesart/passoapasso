const STRING_FILTER = { type: 'string' };
const LIMIT_FILTER = {
  type: 'integer',
  description: 'Quantidade máxima de resultados, entre 1 e 20.',
  minimum: 1,
  maximum: 20,
};

export const READ_ONLY_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'listar_eventos',
      description: 'Consulta eventos ativos no calendário do Organizador. Use sempre que a pergunta envolver agenda, compromissos, eventos ou disponibilidade. Chame imediatamente antes de editar ou excluir um evento; não narre a intenção de consultar.',
      parameters: {
        type: 'object',
        properties: {
          data_inicial: { ...STRING_FILTER, description: 'Data inicial inclusiva no formato YYYY-MM-DD. Se o usuário informar uma data absoluta, use essa data exata.' },
          data_final: { ...STRING_FILTER, description: 'Data final inclusiva no formato YYYY-MM-DD. Para um único dia, repita exatamente data_inicial.' },
          categoria: { ...STRING_FILTER, description: 'Categoria exata ou parcial.' },
          busca: { ...STRING_FILTER, description: 'Somente palavras do título do evento. Nunca inclua data ou horário neste campo.' },
          limite: LIMIT_FILTER,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_evento',
      description: 'Obtém todos os detalhes de um evento ativo usando um ID retornado por listar_eventos.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', description: 'ID exato do evento.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_tarefas',
      description: 'Consulta tarefas ativas do Organizador por status, categoria, prazo ou texto. Chame imediatamente antes de editar ou mover uma tarefa; não narre a intenção de consultar.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['a_fazer', 'em_curso', 'concluido'],
            description: 'Status exato. Omita para consultar todos.',
          },
          categoria: { ...STRING_FILTER, description: 'Categoria exata ou parcial.' },
          prazo_inicial: { ...STRING_FILTER, description: 'Prazo inicial inclusivo no formato YYYY-MM-DD.' },
          prazo_final: { ...STRING_FILTER, description: 'Prazo final inclusivo no formato YYYY-MM-DD.' },
          busca: { ...STRING_FILTER, description: 'Texto contido no título da tarefa.' },
          limite: LIMIT_FILTER,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_tarefa',
      description: 'Obtém todos os detalhes de uma tarefa ativa usando um ID retornado por listar_tarefas.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', description: 'ID exato da tarefa.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_notas',
      description: 'Busca notas ativas por categoria, título ou trecho. Retorna somente uma prévia; use obter_nota para o conteúdo completo.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { ...STRING_FILTER, description: 'Categoria exata ou parcial, como Compras.' },
          busca: { ...STRING_FILTER, description: 'Texto contido no título, conteúdo ou itens.' },
          limite: LIMIT_FILTER,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_nota',
      description: 'Obtém o conteúdo completo de uma nota ativa usando um ID retornado por listar_notas.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', description: 'ID exato da nota.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_habitos',
      description: 'Consulta hábitos ativos, sua recorrência, cor e estado do dia. Chame imediatamente antes de editar, marcar, desmarcar ou excluir um hábito; não narre a intenção de consultar.',
      parameters: {
        type: 'object',
        properties: {
          busca: { ...STRING_FILTER, description: 'Texto contido no nome do hábito.' },
          feito_hoje: { type: 'boolean', description: 'Filtra pelo estado de conclusão no dia atual.' },
          limite: LIMIT_FILTER,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_habito',
      description: 'Obtém todos os detalhes de um hábito ativo usando um ID retornado por listar_habitos.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', description: 'ID exato do hábito.' } },
      },
    },
  },
];

export const READ_ONLY_TOOL_NAMES = new Set(
  READ_ONLY_TOOL_SCHEMAS.map(tool => tool.function.name),
);

const TASK_CATEGORY = {
  type: 'string',
  enum: ['Trabalho', 'Pessoal', 'Saúde', 'Estudos'],
};

const NOTE_CATEGORY = {
  type: 'string',
  enum: ['Trabalho', 'Pessoal', 'Saúde', 'Estudos'],
};

const EVENT_CATEGORY = {
  type: 'string',
  enum: ['Trabalho', 'Pessoal', 'Saúde', 'Estudos'],
};

const HABIT_FREQUENCY = {
  type: 'string',
  enum: ['todos_dias', 'dias_especificos', 'uma_vez'],
};

const HABIT_COLOR = {
  type: 'string',
  enum: ['Azul', 'Oliva', 'Vinho', 'Roxo', 'Verde', 'Grafite'],
};

const HABIT_DAYS = {
  type: 'array',
  description: 'Dias únicos da semana. Obrigatório somente para dias_especificos.',
  minItems: 1,
  maxItems: 7,
  items: { type: 'string', enum: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] },
};

export const WRITE_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'criar_tarefa',
      description: 'Propõe criar uma tarefa. Use somente após um pedido explícito do usuário. A ação dependerá de confirmação visual.',
      parameters: {
        type: 'object',
        required: ['titulo', 'categoria'],
        properties: {
          titulo: { type: 'string', description: 'Título objetivo da tarefa.' },
          categoria: TASK_CATEGORY,
          prazo: { type: 'string', description: 'Prazo opcional no formato YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_tarefa',
      description: 'Propõe editar título, categoria ou prazo de uma tarefa localizada por uma ferramenta de leitura. Exige confirmação visual.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por listar_tarefas.' },
          titulo: { type: 'string' },
          categoria: TASK_CATEGORY,
          prazo: { type: 'string', description: 'Novo prazo YYYY-MM-DD; use string vazia para remover o prazo.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mover_tarefa',
      description: 'Propõe mover uma tarefa para A fazer, Em curso ou Concluído. Localize a tarefa antes e aguarde confirmação visual.',
      parameters: {
        type: 'object',
        required: ['id', 'destino'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por listar_tarefas.' },
          destino: { type: 'string', enum: ['a_fazer', 'em_curso', 'concluido'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_tarefa',
      description: 'Propõe enviar uma única tarefa previamente localizada por listar_tarefas para a Lixeira. Após uma consulta única, chame esta ferramenta imediatamente; a interface exibirá a confirmação reforçada.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_tarefas.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_nota',
      description: 'Propõe criar uma nota comum. Para listas de mercado, use criar_lista_compras. Exige confirmação visual.',
      parameters: {
        type: 'object',
        required: ['titulo', 'categoria'],
        properties: {
          titulo: { type: 'string' },
          categoria: NOTE_CATEGORY,
          conteudo: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_nota',
      description: 'Propõe editar uma nota localizada por uma ferramenta de leitura. Exige confirmação visual.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por listar_notas.' },
          titulo: { type: 'string' },
          categoria: { type: 'string', enum: ['Trabalho', 'Pessoal', 'Saúde', 'Estudos', 'Compras'] },
          conteudo: { type: 'string' },
          itens: {
            type: 'array',
            description: 'Lista completa de itens quando a categoria for Compras.',
            items: { type: 'string' },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_lista_compras',
      description: 'Propõe criar uma nota da categoria Compras com caixas de seleção. Extraia todos os produtos citados para itens separados. Exemplo: "lista Mercado com café e granola" significa titulo="Mercado" e itens=["café", "granola"]. Exige confirmação visual.',
      parameters: {
        type: 'object',
        required: ['titulo', 'itens'],
        properties: {
          titulo: { type: 'string', description: 'Somente o nome da lista, sem os produtos.' },
          itens: {
            type: 'array',
            description: 'Cada produto citado pelo usuário como um item separado; nunca deixe vazio quando produtos foram informados.',
            minItems: 1,
            maxItems: 50,
            items: { type: 'string' },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_nota',
      description: 'Propõe enviar uma única nota previamente localizada por listar_notas para a Lixeira. Após uma consulta única, chame esta ferramenta imediatamente; a interface exibirá a confirmação reforçada.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_notas.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_evento',
      description: 'Propõe criar um evento no calendário. Converta datas relativas para YYYY-MM-DD usando a data de referência. Exige confirmação visual.',
      parameters: {
        type: 'object',
        required: ['titulo', 'data', 'hora', 'categoria'],
        properties: {
          titulo: { type: 'string' },
          data: { type: 'string', description: 'Data exata no formato YYYY-MM-DD.' },
          hora: { type: 'string', description: 'Horário no formato HH:mm, entre 00:00 e 23:59.' },
          categoria: EVENT_CATEGORY,
          lembrete_minutos: { type: 'integer', minimum: 0, maximum: 10080 },
          sincronizar_google: { type: 'boolean', description: 'Use true quando a integração estiver conectada, salvo pedido explícito por evento somente local.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_evento',
      description: 'Propõe editar um evento localizado por listar_eventos. Não escolha entre eventos ambíguos. Eventos já vinculados também serão atualizados no Google após confirmação.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_eventos.' },
          titulo: { type: 'string' },
          data: { type: 'string', description: 'Nova data YYYY-MM-DD.' },
          hora: { type: 'string', description: 'Novo horário HH:mm.' },
          categoria: EVENT_CATEGORY,
          lembrete_minutos: { type: 'integer', minimum: 0, maximum: 10080 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_evento',
      description: 'Propõe excluir um único evento previamente localizado por listar_eventos. Nunca escolha quando a consulta retornar mais de um resultado. Exige confirmação reforçada.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_eventos.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_habito',
      description: 'Propõe criar um hábito. Para dias específicos, envie todos os dias solicitados. A ação depende de confirmação visual.',
      parameters: {
        type: 'object',
        required: ['nome', 'frequencia'],
        properties: {
          nome: { type: 'string', description: 'Nome curto do hábito.' },
          frequencia: HABIT_FREQUENCY,
          dias: HABIT_DAYS,
          cor: HABIT_COLOR,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editar_habito',
      description: 'Propõe editar um único hábito previamente localizado por listar_habitos. Não escolha entre hábitos ambíguos.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_habitos.' },
          nome: { type: 'string' },
          frequencia: HABIT_FREQUENCY,
          dias: HABIT_DAYS,
          cor: HABIT_COLOR,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_habito_do_dia',
      description: 'Propõe marcar ou desmarcar hoje um único hábito localizado por listar_habitos. Use concluido=true para marcar e concluido=false somente quando o usuário pedir explicitamente para desmarcar.',
      parameters: {
        type: 'object',
        required: ['id', 'concluido'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_habitos.' },
          concluido: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_habito',
      description: 'Propõe enviar um único hábito previamente localizado para a Lixeira. Após uma consulta única, chame esta ferramenta imediatamente; não peça confirmação em texto, pois a interface exibirá a confirmação reforçada.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID exato retornado por uma consulta única em listar_habitos.' },
        },
      },
    },
  },
];

export const WRITE_TOOL_NAMES = new Set(
  WRITE_TOOL_SCHEMAS.map(tool => tool.function.name),
);

export const ORGANIZER_TOOL_SCHEMAS = [
  ...READ_ONLY_TOOL_SCHEMAS,
  ...WRITE_TOOL_SCHEMAS,
];
