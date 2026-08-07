# Migração para o Firebase (Tempo Real)

O objetivo desta etapa é substituir os dados estáticos locais (mock data) por um banco de dados real na nuvem utilizando o Firebase Firestore. Isso permitirá que você e sua namorada utilizem o aplicativo simultaneamente com sincronização instantânea em todos os dispositivos, abrindo caminho para o bot do WhatsApp.

## 1. Roadmap de Criação no Firebase (Ação Necessária)

Siga este passo a passo rápido para gerar o banco de dados:

1. **Criar o Projeto:**
   - Acesse o [Firebase Console](https://console.firebase.google.com/).
   - Clique em **Adicionar Projeto** e nomeie como `passo-a-passo`.
   - Desative o Google Analytics (não precisamos disso para uso pessoal).
2. **Ativar o Banco de Dados:**
   - No menu lateral esquerdo, clique em **Build** > **Firestore Database**.
   - Clique em **Create Database**.
   - Escolha a localização mais próxima (ex: `nam5 (us-central)` ou `southamerica-east1`).
   - Selecione **"Start in Test Mode"** (Iniciar em Modo de Teste) para não nos preocuparmos com regras de segurança de imediato.
3. **Registrar o App Web:**
   - Na página inicial do seu projeto (Project Overview), clique no ícone de web `</>` (abaixo de "Adicione um app para começar").
   - Dê um apelido (ex: `passo-web`) e registre o app.
4. **Copiar as Chaves:**
   - O Firebase vai exibir um bloco de código contendo o `firebaseConfig`. Copie todo o objeto que se parece com isso:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "passo-a-passo...",
       projectId: "passo-a-passo...",
       // ...
     };
     ```
   - **Cole esse bloco no nosso chat para darmos andamento!**

---

## 2. O que será configurado no código a seguir

Assim que você me enviar as chaves, faremos as seguintes modificações técnicas:

- Instalação do SDK (`npm install firebase`).
- Criação do arquivo seguro de conexão `src/firebaseConfig.js`.
- Refatoração do arquivo principal (`src/App.jsx`) para que Tarefas, Hábitos, Eventos e Notas passem a utilizar as funções de gravação direta na nuvem (`addDoc`, `updateDoc`, `deleteDoc`).
- Implementação de Listeners em tempo real (`onSnapshot`) para que a tela atualize sozinha ao receber novos dados.
