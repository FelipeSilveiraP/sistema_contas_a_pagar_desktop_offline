# Active Context

## Foco Atual
**Navbar desktop: botões brancos por padrão + hover na cor do módulo do Menu — aguardando validação**
(branch `feature/entrega-3.1-sqlite-banco`, commit local, NENHUM push, `main` intacta). Removido o
preenchimento azul fixo do módulo ativo (o CADASTROS ficava constantemente azul nas telas-filhas);
agora todo botão tem fundo branco e o hover pinta com a cor do botão respectivo da tela do Menu
(MENU PRINCIPAL `#FFE600`, CADASTROS `#FF8400`, CONTROLE `#38BDF8`, MENSAGENS `#FF5E89`,
GRÁFICOS `#00FF66`, VOLTAR neutro `#eee`). Hover validado com mouse REAL do Windows.
Testes: smoke 246/246, smoke-real 2 ciclos APROVADO (inclui hover real + captura
`nav-hover-cadastros.png`). Aguardando validação visual.

## ETAPA 1 — Causa raiz dos inputs não clicáveis (2026-11-07)
- **Sintoma:** formulários renderizavam mas nenhum clique/digitação/cursor funcionava; alt-tab
  ("trocar de janela") ou reiniciar consertava
- **Diagnóstico:** DOM/CSS/JS exonerados (hit-test limpo, sem overlays, sem preventDefault em mouse,
  sem disabled/readonly); com eventos REAIS (SendInput) quando a janela está ativada, tudo funciona;
  com a janela visível mas sem ativação, os cliques caem em OUTRA janela e o app não ativa
- **Causa:** `criarJanela` usava `show:true` padrão — a janela sobe sem foco nem topo de z-order
- **Correção:** `show:false` + `ready-to-show` → `show()+setAlwaysOnTop(nudge)+moveTop()+focus()`;
  `did-finish-load` → `focus()`; launcher `EXECUTAR_SISTEMA.bat` apontava para o JavaFX legado —
  agora abre o Electron
- **Testes:** `desktop/smoke-real.js` (entrada real, 2 ciclos com fechar/reabrir): clique nos inputs,
  digitação, TAB, backspace/edição, troca de formulário, navbar hambúrguer/véu/ESC, bloqueios
  invisíveis (elementFromPoint), estabilidade dos campos

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
- **Frontend:** `form-banco.html`/`form-banco.ts` (2 campos: instituição obrigatória, chave Pix
  opcional), validação espelhada + erros por campo, feedback sucesso/erro,
  dirty-form com `window.confirm` em VOLTAR/navbar/ESC/CANCELAR, navbar com módulo CADASTROS ativo
- **Navegação:** Menu → Cadastros → Novo Cadastro → Banco (fluxo completo testado via UI)

## Entrega 3.2 (Pagador — implementada, aguardando validação)
- **Campos aprovados pelo usuário:** `nome` (obrigatório 2–120), `cpf` (obrigatório, dígitos
  verificadores mod 11, normalizado para dígitos), `funcao` (opcional, cargo, ≤60)
- **SQLite:** migração v3 cria `pagadores (id_pagador, nome, cpf, funcao)` — aditiva, sem risco a dados
- **API:** CRUD `/api/pagadores` (mesmo padrão do Banco); model/repo/service/controller novos
- **Frontend:** `form-pagador.html`/`form-pagador.ts` (identidade vermelha `#dc2626`, navbar CADASTROS,
  validação espelhada incluindo CPF, dirty-form); botão e atalho 2 de Novo Cadastro conectados
- **Testes:** JUnit 56/56 (13 service + 10 API novos), smoke 232/232 (form-pagador completo),
  persistência 11/11 (pagador no ciclo fechar/reabrir); capturas `form-pagador-{1536x864,768x800,480x800}.png`
- Divergências resolvidas: DER legado PF/PJ NÃO implementado (escopo simplista aprovado); "função"
  = cargo/função da pessoa; CPF é de pessoa física (VBA: responsável pelo pagamento)

## Descobertas/ajustes
- API Stitch MCP indisponível (404 no endpoint) e modelo sem leitura de imagem — campos do form Banco
  confirmados por **triangulação**: modelo Java legado (`b4fe64b`), `docs/plano-telas.md` §3.2 e o
  documento do usuário (§6). **Falha registrada; configuração MCP preservada como está — PROIBIDO
  alterar credenciais ou configurações globais para contornar o 404 sem autorização explícita**
- **Regra permanente de testes (definida pelo usuário):** testes automatizados usam SEMPRE bancos
  temporários/isolados via `FINDESK_DB_PATH`; nunca misturar dados de teste com dados de utilização
  normal; preservar integridade SQLite + backup/restauração; NENHUMA operação destrutiva no banco
  operacional quando começarmos a usar na empresa
- Entidade = **instituição bancária** com chave Pix opcional (simplificada pelo usuário na correção
  pós-3.1): `instituicao` (obrigatória 2–120), `chavePix` (opcional, ≤77, sem espaços). Migração v2
  reconstruiu a tabela preservando `id_banco`/`instituicao`/`chave_pix`; `codigo_banco`, `agencia` e
  `conta` removidos de model/API/frontend/validações
- Smoke roda com `FINDESK_DB_PATH` em temp (nunca toca a base real); `desktop/teste-persistencia.js`
  cobre o ciclo fechar/reabrir na base real, criando e apagando registro fictício
- Helper `medirTela` do smoke tolerante a páginas sem grade (form-banco)

## Git
- `feature/entrega-3.1-sqlite-banco` (a partir de `feature/navbar-global` = `b349235`); HEAD = `ad6280f`
  (commit de preservação — não alterar)
- Correção do Banco (19 arquivos) + Memory Bank no working tree, NÃO commitados — commit aguarda ordem
- `main`/`develop`/`feature/navbar-global` preservadas; NADA publicado (push AGUARDA autorização)

## Pendências
1. Validação do usuário: correção do Banco (instituição + Pix) + Entrega 3.2 (Pagador); capturas em
   `docs/responsivo/form-{banco,pagador}-{1536x864,768x800,480x800}.png`
2. Push ao GitHub — AGUARDA autorização explícita
3. Entrega 3.3 (Empresa) — NÃO iniciar sem autorização; sequência conforme plano
