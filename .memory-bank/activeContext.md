# Active Context

## Foco Atual
**Entrega 3.1 CONCLUÍDA — aguardando validação do usuário** (branch `feature/entrega-3.1-sqlite-banco`,
commit de preservação local, NENHUM push): nome oficial aplicado + fundação SQLite + Cadastro de Banco
funcional de ponta a ponta. Testes: JUnit 35/35, smoke 220/220, persistência com reinício 8/8.
Próximo passo: SOMENTE após validação — Entrega 3.2 (Pagador). NÃO iniciar sem autorização.

## Entrega 3.1 (fundação SQLite + Banco)
- **Nome oficial:** "Sistema de Contas a Pagar — Chaveiro Universal" em janela Electron, títulos das
  páginas, README, docs e mensagens ao usuário. Identificadores técnicos preservados (`X-FinDesk-Token`,
  `findesk.*`, `window.finDesk`, pacotes Java, `FinDeskApplication`, nome do jar)
- **SQLite:** `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\contas_a_pagar.db` (override `FINDESK_DB_PATH`),
  WAL + `foreign_keys` + `busy_timeout`, migrações versionadas via `PRAGMA user_version` (v1 = `bancos`),
  nunca recriação destrutiva; separação banco de teste (`backend/src/test/resources`)
- **Backup:** `VACUUM INTO` (snapshot consistente em WAL — cópia simples de arquivo não serve),
  backup diário (1/dia, mantém 8), backup pré-migração, restauração com `PRAGMA integrity_check`
- **Backend:** Model/Repository/Service/Controller (`Banco*`), PreparedStatements, transações explícitas,
  erros padronizados (400+campos / 404 / 409 FK), sem SQL nos controllers
- **API:** CRUD `/api/bancos` (GET list/por id, POST 201+Location, PUT, DELETE 204; 409 se vinculado)
- **Segurança:** token aleatório 24 bytes por inicialização (Electron `crypto.randomBytes` → env
  `FINDESK_API_TOKEN` → backend falha rápido sem token; default `dev-token-local` REMOVIDO);
  token não aparece em logs (testado); API só em 127.0.0.1
- **Frontend:** `form-banco.html`/`form-banco.ts` (5 campos: instituição, código bancário, agência,
  conta, chave Pix opcional), validação espelhada + erros por campo, feedback sucesso/erro,
  dirty-form com `window.confirm` em VOLTAR/navbar/ESC/CANCELAR, navbar com módulo CADASTROS ativo
- **Navegação:** Menu → Cadastros → Novo Cadastro → Banco (fluxo completo testado via UI)

## Descobertas/ajustes
- API Stitch MCP indisponível (404 no endpoint) e modelo sem leitura de imagem — campos do form Banco
  confirmados por **triangulação**: modelo Java legado (`b4fe64b`), `docs/plano-telas.md` §3.2 e o
  documento do usuário (§6). Divergência com a tela real → ajustar na validação do usuário
- Entidade = **conta bancária** de uma instituição (não a instituição em si): `instituicao`,
  `codigoBanco`, `agencia`, `conta`, `chavePix`; validações pragmáticas (não rejeitar dados válidos)
- Smoke roda com `FINDESK_DB_PATH` em temp (nunca toca a base real); `desktop/teste-persistencia.js`
  cobre o ciclo fechar/reabrir na base real, criando e apagando registro fictício
- Helper `medirTela` do smoke tolerante a páginas sem grade (form-banco)

## Git
- `feature/entrega-3.1-sqlite-banco` (a partir de `feature/navbar-global` = `b349235`)
- `main`/`develop`/`feature/navbar-global` preservadas; NADA publicado (push AGUARDA autorização)

## Pendências
1. Validação do usuário na Entrega 3.1 (inclui conferência visual do form-banco contra a tela Stitch real)
2. Push ao GitHub — AGUARDA autorização explícita
3. Entrega 3.2 (Pagador) — NÃO iniciar sem autorização; sequência 3.2–3.10 conforme plano
