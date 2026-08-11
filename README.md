# Organizador Pessoal

Um aplicativo web minimalista e focado em produtividade para gerenciamento completo da sua rotina. Construído com React, Tailwind CSS e Firebase, este projeto visa resolver a sobrecarga de informações consolidando Tarefas, Hábitos, Anotações e Calendário em um único lugar seguro.

## Funcionalidades Principais

- **Painel Principal:** Visão geral do clima, tarefas prioritárias do dia e atalhos rápidos.
- **Tarefas (To-Do):** Gestão de tarefas com prioridades, datas de vencimento e organização inteligente.
- **Hábitos:** Acompanhamento de hábitos diários com cálculo automático de ofensivas (streaks).
- **Notas:** Bloco de notas estruturado por categorias para guardar ideias e rascunhos.
- **Calendário Mensal:** Visão ampla dos compromissos e integração rápida.
- **Foco (Pomodoro):** Timer embutido para maximizar a produtividade através da técnica Pomodoro.
- **Mensagens (Chat P2P):** Chat seguro e isolado com outros usuários do sistema.

## Inteligência Artificial Local (BYOAI - Bring Your Own AI)

Este projeto possui uma abordagem de IA orientada à **Privacidade Absoluta**.
Em vez de enviar os seus dados para servidores externos (como OpenAI ou Google), o aplicativo foi desenvolvido para se conectar diretamente a um modelo de IA rodando **na sua própria máquina**.

A IA atua como um "Ajudante do Dia", capaz de ler a sua rotina (tarefas, notas e hábitos) e responder dúvidas, ajudar na priorização ou fornecer conselhos pessoais e profissionais.

### Como habilitar a IA Local

1. **Baixe o Ollama:** Acesse [ollama.com](https://ollama.com/) e instale no seu computador.
2. **Baixe o Modelo:** Abra seu terminal e rode o comando:
   ```bash
   ollama run llama3.2
   ```
3. **Mantenha Rodando:** Sempre que quiser utilizar a IA no aplicativo, o Ollama deve estar rodando em segundo plano. Os seus dados de rotina nunca sairão do seu computador.

> **Nota para Desenvolvedores:**
> A IA pode ser habilitada ou desabilitada no frontend através da variável de ambiente `VITE_ENABLE_LOCAL_AI=true`. Isso permite implantar o código num servidor público e manter a aba de IA restrita a usos em desenvolvimento/local.

## Tecnologias Utilizadas

- **Frontend:** React, Vite, Tailwind CSS, Framer Motion
- **Ícones:** Lucide React
- **Backend & Banco de Dados:** Firebase (Firestore, Auth)
- **IA Engine:** Ollama (Local LLM)
- **Hospedagem Recomendada:** Netlify / Vercel

## Como Rodar o Projeto

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/organizador.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente baseadas no Firebase no arquivo `.env`:
   ```env
   VITE_FIREBASE_API_KEY=sua_api_key
   VITE_FIREBASE_AUTH_DOMAIN=seu_domain
   VITE_FIREBASE_PROJECT_ID=seu_project_id
   VITE_FIREBASE_STORAGE_BUCKET=seu_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
   VITE_FIREBASE_APP_ID=seu_app_id
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Licença

Este projeto é de uso pessoal.
