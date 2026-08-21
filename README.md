# passo.a.passo

Organizador pessoal para centralizar tarefas, hábitos, notas, compromissos e sessões de foco em uma única aplicação. A interface segue uma direção editorial inspirada em Paper UI, com tipografia expressiva, hierarquia clara e elementos que remetem a registros em papel.

O projeto utiliza React e Firebase e oferece, opcionalmente, o **Ajudante do Dia**, um assistente executado localmente com Ollama. O modelo interpreta o pedido, mas toda leitura, validação e alteração de dados permanece sob o controle do Organizador.

## Funcionalidades

### Painel principal

- Resumo da rotina em uma visão única.
- Agenda semanal e calendário mensal.
- Widget de clima.
- Quadro de tarefas com as colunas A fazer, Em curso e Concluído.
- Movimentação de tarefas entre colunas por arrastar e soltar.
- Rastreador diário de hábitos.
- Visualização completa das notas a partir do painel.

### Tarefas

- Criação e edição de título, categoria e prazo.
- Organização por status em um quadro com três colunas.
- Movimentação entre status por arrastar e soltar.
- Cores associadas às categorias.
- Exclusão lógica com recuperação pela Lixeira.

### Hábitos

- Frequência diária, em dias específicos ou em registro único.
- Cores no formato de cartões inspirados em post-its.
- Marcação e desmarcação do estado diário.
- Edição de nome, frequência, dias e cor pelo assistente.
- Exclusão lógica com recuperação pela Lixeira.

### Notas

- Criação, leitura e edição de notas.
- Categorias Trabalho, Pessoal, Saúde e Estudos.
- Categoria Compras com itens marcáveis, adequada para listas de mercado.
- Exclusão lógica com recuperação pela Lixeira.

### Calendário

- Visualização mensal com navegação entre meses.
- Criação, edição e exclusão de eventos.
- Categoria, horário e lembrete configuráveis.
- Sincronização opcional com o Google Calendar.
- Tratamento explícito de falhas parciais entre Organizador, Firebase e Google Calendar.

### Foco e comunicação

- Temporizador Pomodoro com associação opcional a uma tarefa em andamento.
- Área de mensagens para usuários autenticados.
- Notificações visuais integradas à linguagem editorial da aplicação.

## Ajudante do Dia

O Ajudante do Dia utiliza um modelo executado pelo Ollama na máquina do usuário. O modelo principal recomendado é o `qwen3.5:4b`, com `llama3.2` mantido como alternativa.

### Capacidades atuais

O assistente pode consultar tarefas, notas, eventos e hábitos e, após um pedido explícito, propor as seguintes ações:

- criar, editar, mover e excluir tarefas;
- criar, editar e excluir notas;
- criar listas de compras;
- criar, editar e excluir eventos;
- sincronizar alterações de eventos com o Google Calendar;
- criar e editar hábitos;
- marcar ou desmarcar hábitos no dia atual;
- excluir hábitos para a Lixeira.

### Modelo de segurança

O Qwen não recebe acesso direto ao Firebase, aos setters do React, ao token do Google ou ao sistema operacional. O fluxo de uma alteração é:

1. O modelo solicita uma ferramenta estruturada.
2. O Organizador valida ferramenta, argumentos e registro selecionado.
3. A interface apresenta um cartão de confirmação.
4. O usuário confirma ou cancela a ação.
5. O executor atualiza o estado e sincroniza os serviços aplicáveis.
6. O resultado é devolvido ao chat.

Todas as alterações exigem confirmação. Exclusões usam confirmação reforçada e são enviadas para a Lixeira quando o tipo de registro permite. Ações confirmadas podem ser desfeitas individualmente sem restaurar o estado inteiro da aplicação.

### Auditoria

As ações do assistente geram um histórico de auditoria com:

- ferramenta solicitada;
- argumentos validados e sanitizados;
- estado da confirmação;
- resultado da execução;
- referência de uma eventual reversão.

Prompts completos, credenciais, tokens e o conteúdo integral de notas não são gravados na auditoria. A retenção é limitada a 50 entradas ou 30 dias.

### Privacidade e serviços externos

As inferências do modelo são processadas localmente pelo Ollama. Entretanto, o aplicativo não opera inteiramente offline:

- tarefas, hábitos, notas, eventos e auditoria podem ser persistidos no Firebase;
- eventos podem ser enviados ao Google Calendar quando a integração estiver ativa;
- o widget de clima depende de um serviço externo.

O token do Google Calendar permanece no executor da aplicação e não é incluído no contexto enviado ao modelo.

## Tecnologias

- React 19
- Vite 8
- Tailwind CSS 4
- Firebase Authentication e Firestore
- Framer Motion
- Lucide React
- Ollama com `qwen3.5:4b`
- Node Test Runner
- Oxlint
- Vite PWA

## Requisitos

- Node.js e npm compatíveis com o projeto.
- Projeto configurado no Firebase.
- Ollama instalado para utilizar o Ajudante do Dia.
- Projeto e credenciais OAuth do Google configurados para a sincronização do calendário.

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/lellesart/passoapasso.git
cd passoapasso
npm install
```

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
VITE_FIREBASE_APP_ID=seu_app_id

VITE_ENABLE_LOCAL_AI=true
```

No Firebase, habilite a autenticação com Google e configure o Firestore. Para sincronizar compromissos, habilite também a Google Calendar API e autorize o escopo de eventos utilizado pela aplicação.

### Regras de segurança do Firestore

O arquivo `firestore.rules` restringe cada documento `users/{uid}` ao próprio usuário autenticado. Conversas e mensagens podem ser acessadas apenas pelos participantes registrados, e novas mensagens precisam identificar o e-mail da conta autenticada como remetente.

Revise o projeto selecionado e publique as regras separadamente do deploy do frontend:

```bash
npx firebase-tools deploy --only firestore:rules --project SEU_PROJECT_ID
```

Depois da publicação, valide com duas contas diferentes:

1. Cada conta deve continuar lendo e alterando apenas seu próprio organizador.
2. Uma conta não deve conseguir acessar `users/{uid}` da outra.
3. Uma conversa deve aparecer somente para os dois participantes.
4. Um participante deve conseguir enviar e ler mensagens; terceiros não devem conseguir abrir a conversa.

## Configuração do Ollama

Instale o Ollama a partir de [ollama.com](https://ollama.com/) e baixe o modelo recomendado:

```bash
ollama pull qwen3.5:4b
```

Mantenha o serviço do Ollama ativo durante o uso local:

```bash
ollama serve
```

O frontend procura o serviço em `http://localhost:11434`. A interface da IA é exibida somente quando `VITE_ENABLE_LOCAL_AI=true`.

## Desenvolvimento

Inicie o servidor local:

```bash
npm run dev
```

Comandos disponíveis:

```bash
npm test
npm run lint
npm run build
npm run preview
npm run test:ai-local
```

`npm run test:ai-local` executa testes de integração contra o `qwen3.5:4b` instalado no Ollama. O serviço local deve estar ativo antes da execução.

## Deploy e uso no celular

A aplicação pode ser publicada como PWA e atualmente é utilizada com deploy automatizado pelo Netlify a partir do repositório.

O navegador bloqueia chamadas de uma página HTTPS para o Ollama exposto em HTTP local. Por isso, o Ajudante do Dia ainda não funciona diretamente no deploy ou no celular sem uma ponte HTTPS autenticada. A porta `11434` não deve ser exposta diretamente à internet.

As funções manuais do Organizador, o Firebase e a integração com o Google Calendar continuam disponíveis independentemente do Ollama.

## Documentação técnica

O planejamento da integração da IA, as decisões de segurança e o status das fases estão documentados em [Roadmap da IA — Ajudante do Dia](./obsidian-vault/Roadmap_IA_Ajudante_do_Dia.md).

## Estado dos testes

As fases de leitura, escrita de tarefas e notas, calendário, hábitos, exclusão, reversão e auditoria possuem cobertura automatizada. A suíte atual contém 60 testes, além de casos de integração executados diretamente contra o `qwen3.5:4b` local.

## Licença

Projeto de uso pessoal. Consulte o responsável pelo repositório antes de reutilizar ou redistribuir o código.
