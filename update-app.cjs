const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Update navItems
code = code.replace(
  /{ id: 'chat', label: 'Mensagens' },\n\s+{ id: 'trash', label: 'Lixeira' }/,
  "{ id: 'chat', label: 'Mensagens' },\n    { id: 'ai_setup', label: 'Assistente IA' },\n    { id: 'trash', label: 'Lixeira' }"
);

// 2. Add AI Setup View
const aiSetupView = `              {activeTab === 'ai_setup' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                  <header className="mb-8">
                    <h1 className="text-3xl font-black text-stone-800 tracking-tight mb-2">Assistente IA Local</h1>
                    <p className="text-stone-500">Configure sua inteligência artificial privada e 100% gratuita.</p>
                  </header>

                  <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
                    <div className="flex items-start gap-6 mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Brain className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-stone-800 mb-2">Traga sua Própria IA (BYOAI)</h2>
                        <p className="text-stone-600 leading-relaxed">
                          O Organizador Pessoal foi construído com foco em <strong>privacidade absoluta</strong>.
                          Em vez de enviar suas notas e tarefas para a nuvem da OpenAI ou Google, este aplicativo
                          se conecta a uma IA que roda <strong>diretamente no seu computador</strong>.
                        </p>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-stone-800 mb-4 border-b border-stone-100 pb-2">Como Ativar (Passo a Passo)</h3>
                    
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">1</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Baixe e instale o Ollama</h4>
                          <p className="text-stone-600 text-sm mt-1">O Ollama é o motor que roda os modelos de IA no seu computador.</p>
                          <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium underline">Baixar Ollama no site oficial</a>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">2</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Baixe o Modelo (Llama 3)</h4>
                          <p className="text-stone-600 text-sm mt-1">Abra o seu Terminal (Mac/Linux) ou Prompt de Comando (Windows) e digite o seguinte comando:</p>
                          <div className="mt-2 bg-stone-900 text-stone-200 px-4 py-2 rounded-lg font-mono text-sm inline-block">
                            ollama run llama3.2
                          </div>
                          <p className="text-stone-500 text-xs mt-2">O download tem cerca de 2GB a 4GB. Aguarde a conclusão.</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">3</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Deixe rodando no fundo</h4>
                          <p className="text-stone-600 text-sm mt-1">Pronto! Sempre que você quiser que o Ajudante do Dia funcione aqui no aplicativo, basta garantir que o programa Ollama esteja aberto no seu computador. Os dados nunca saem da sua máquina.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
`;

code = code.replace(
  "{activeTab === 'trash' && (",
  aiSetupView + "              {activeTab === 'trash' && ("
);

// 3. Update the feature toggle
code = code.replace(
  "<LocalAIAssistant tasks={tasks} habits={habits} notes={notes} user={user} />",
  "{(import.meta.env.VITE_ENABLE_LOCAL_AI === 'true') && <LocalAIAssistant tasks={tasks} habits={habits} notes={notes} user={user} />}"
);

fs.writeFileSync('src/App.jsx', code);
