# Checklist — Sincronização por usuário

Objetivo: garantir que cada conta autenticada tenha seus próprios dados salvos em `users/{uid}`, sem dados de demonstração, mistura entre usuários ou falhas silenciosas de sincronização.

## Fase 1 — Fonte oficial e salvamento por usuário

- [x] Definir `users/{uid}` como única fonte oficial dos dados do organizador.
- [x] Criar documento de usuário vazio apenas com metadados e arrays vazios.
- [x] Remover dados demo do fluxo de criação/carregamento de usuários reais.
- [x] Normalizar documentos carregados do Firestore antes de preencher a interface.
- [x] Salvar tarefas, hábitos, notas, eventos, estado diário e auditoria sempre em `users/{uid}`.
- [x] Gravar metadados em cada sincronização: `ownerUid`, `ownerEmail`, `schemaVersion`, `updatedAt`.
- [x] Validar localmente com duas contas.

## Fase 2 — Status de sincronização e proteção contra falhas

- [ ] Adicionar indicador visual de status: salvando, salvo, erro, local/offline.
- [ ] Exibir aviso claro quando uma alteração não sincronizar com Firestore.
- [ ] Bloquear mensagens de sucesso quando a alteração ficar apenas local.
- [ ] Revisar todos os fluxos que chamam `syncToFirestore`.

## Fase 3 — Backup local e exportação

- [ ] Criar backup local por `uid` antes/depois de alterações relevantes.
- [ ] Adicionar ação `Exportar backup`.
- [ ] Adicionar ação `Importar backup`.
- [ ] Validar o backup antes de restaurar dados.
- [ ] Impedir importação acidental em conta diferente sem confirmação explícita.

## Fase 4 — Regras do Firestore

- [ ] Aplicar regra para `users/{uid}`: somente o próprio usuário lê e escreve.
- [ ] Revisar permissões da coleção `chats`.
- [ ] Testar leitura/escrita com duas contas diferentes.

## Fase 5 — Limpeza, validação e deploy

- [ ] Remover diagnóstico temporário ou converter em painel simples de status.
- [x] Rodar `npm test`.
- [x] Rodar `npm run lint`.
- [x] Rodar `npm run build`.
- [ ] Fazer commit.
- [ ] Fazer push.
- [ ] Validar no Netlify.
- [ ] Validar no PWA instalado.
