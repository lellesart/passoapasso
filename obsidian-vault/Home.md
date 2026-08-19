# passo.a.passo - Documentação Oficial

> [!NOTE]
> Este documento centraliza o planejamento, diretrizes e o roadmap do projeto passo.a.passo. Ele foi estruturado de forma objetiva e sem uso de emojis para ser utilizado como página inicial (Master Note) em um vault do Obsidian.

## 1. Visão Geral do Projeto
- **Nome:** passo.a.passo (Passo a Passo)
- **Propósito:** Ferramenta de organização pessoal para acompanhamento de tarefas, hábitos, calendário e notas.
- **Público-alvo:** Uso pessoal restrito (2 usuários).
- **Diferenciais:** Notificações via WhatsApp, design premium inspirado no Notion, foco em usabilidade rápida e estética minimalista.

## 2. Diretrizes de Design (UI/UX)
- **Tipografia:** Inter (via Google Fonts). Utilização de pesos variando do 300 ao 900 para estabelecer uma hierarquia visual clara.
- **Estética Visual (UI):** Minimalista, limpa, utilizando sombras difusas (drop shadows amplos e suaves) e ausência de bordas rígidas para os componentes principais.
- **Paleta de Cores:** Fundo claro (Slate, `#F8FAFC`), com textos apresentando alto contraste (Slate 800 e 900). Cores de destaque utilizadas apenas para sinalizar estado (ações, prioridades ou clima).
- **Experiência do Usuário (UX):**
  - **Animações:** Utilização da biblioteca Framer Motion para micro-interações (escala de botões ao clicar) e transições suaves entre abas, evitando quebras secas na navegação.
  - **Feedback Visual:** Implementação de toasts empilháveis e não-intrusivos (Sonner) para alertas do sistema e simulações do WhatsApp, descartando o uso de modais de bloqueio sempre que possível.

## 3. Arquitetura Técnica
- **Frontend:** React 19, Vite, Tailwind CSS v4.
- **Ícones:** Lucide React.
- **Backend / Banco de Dados (Arquitetura Proposta):**
  - **Armazenamento:** Firebase Firestore (banco de dados NoSQL com sincronização em tempo real).
  - **Processamento em Segundo Plano:** Vercel Serverless Functions ou equivalentes.
  - **Agendamento (Cron Jobs):** Serviços externos gratuitos (ex: GitHub Actions ou cron-job.org) pingando a Serverless Function periodicamente.
  - **Integração de Mensageria:** CallMeBot API (solução de baixo atrito para notificações pessoais no WhatsApp, contornando a burocracia da API oficial da Meta).

## 4. Roadmap de Desenvolvimento

### Fase 1: Fundação e Interface Base (Concluída)
- Estruturação do ambiente de desenvolvimento (React + Vite).
- Configuração do motor de estilos (Tailwind CSS v4).
- Implementação da estrutura de navegação lateral responsiva.
- Desenvolvimento das telas base: Dashboard, Calendário, Tarefas, Hábitos, Notas e Pomodoro.
- Integração do Widget de Clima dinâmico consumindo a API de Geolocalização e a Open-Meteo API.
- Instalação e configuração de bibliotecas avançadas de UI (Framer Motion, Sonner, clsx, tailwind-merge).
- Rebranding estrutural e visual para a marca "passo.a.passo".

### Fase 2: Integração de Dados (Próxima Etapa)
- Configuração do ambiente no Firebase Console.
- Instalação do SDK do Firebase no projeto frontend.
- Conexão da camada de visualização com o Firestore para substituição dos dados estáticos por dados persistentes.
- Implementação de lógica de identificação de usuários (separação de contexto entre os 2 usuários).
- Garantia de sincronização em tempo real entre diferentes dispositivos.

### Fase 3: Automação e WhatsApp
- Desenvolvimento de Serverless Function para varredura do banco de dados em busca de eventos próximos.
- Integração do código backend com a API do CallMeBot.
- Configuração do serviço de agendamento (Cron Job) para validação a cada 5 minutos.
- Definição da lógica de disparo baseada no horário estipulado e preferências de notificação do usuário.

### Fase 4: Refinamento e Funcionalidades Avançadas
- Implementação de sistema de relatórios automáticos via WhatsApp (resumo do dia).
- Aprimoramento da interface de monitoramento de hábitos com visualização gráfica de progresso (integração de bibliotecas de gráficos).
- Configuração de PWA (Progressive Web App) para permitir instalação nativa nos dispositivos móveis.

## 5. Backlog de Tarefas Imediatas
- [ ] Criar projeto e banco de dados no Firebase Console.
- [ ] Extrair credenciais e chaves de configuração do Firebase.
- [ ] Executar a instalação do SDK (`npm install firebase`).
- [ ] Criar a estrutura inicial de conexão de banco (`src/firebaseConfig.js`).

> [!IMPORTANT]
> A transição para a Fase 2 está diretamente bloqueada pela necessidade de geração das credenciais do Firebase. Este é o passo crítico atual.

## 6. Documentação da IA

- [[Roadmap_IA_Ajudante_do_Dia|Roadmap da IA — Ajudante do Dia]]

> [!NOTE]
> O roadmap da IA registra o estado mais recente do projeto, incluindo Qwen local, Firebase e Google Calendar já configurados. Em caso de divergência com etapas históricas desta página, considere o roadmap da IA como a referência atual para o assistente.
