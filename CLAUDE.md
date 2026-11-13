# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Projeto: **Sistema de Contas a Pagar — Chaveiro Universal** — app desktop 100% offline (Electron + TypeScript puro + Spring Boot 3.3/Java 21 + SQLite WAL) que substitui uma planilha Excel/VBA. Código, comentários, commits e UI são em português.

`AGENTS.md` contém as regras permanentes do projeto (segurança, banco operacional, git, testes obrigatórios, tabela de skills) — siga-o. As skills do projeto ficam em `.claude/skills/` (fluxo-de-entrega, electron-desktop, frontend-telas, backend-spring, sqlite-financeiro, testes, depuracao, simplicidade). No início de uma tarefa leia `docs/estado-atual.md` (foco e pendências) e consulte `docs/decisoes.md` (decisões de negócio e arquitetura já tomadas); ao concluir uma entrega reescreva `estado-atual.md` (máx. 30 linhas) e acrescente as decisões novas em `decisoes.md`.

## Comandos

```bash
npm install                       # deps de frontend/desktop
mvn -f backend/pom.xml package    # gera backend/target/findesk-backend-0.1.0.jar (o Electron executa este jar)
npm run dev                       # typecheck + Tailwind + esbuild, depois abre o Electron
npm run app                       # abre o Electron sem rebuild do frontend
npm run typecheck                 # tsc --noEmit (strict)
npm run build                     # typecheck + build:css + build:ts → frontend/dist/
```

Testes (todos obrigatórios antes de concluir uma entrega — ver AGENTS.md §4):

```bash
mvn -f backend/pom.xml test                                   # JUnit 5 + MockMvc
mvn -f backend/pom.xml test -Dtest=ContaServiceTest           # uma classe
mvn -f backend/pom.xml test -Dtest=ContaServiceTest#nomeDoMetodo  # um método
npx electron desktop/smoke.js          # navegação/layout/diálogos em várias resoluções; grava capturas em docs/responsivo/
npx electron desktop/smoke-boot.js     # tempos de boot + interação imediata
npx electron desktop/smoke-real.js     # entrada real do Windows (SendInput via desktop/entrada-real.ps1)
node desktop/smoke-dev.js              # reproduz `npm run dev` com entrada real — regressão obrigatória do bug de foco dos inputs
node desktop/teste-persistencia.js     # cold start: dados sobrevivem ao reinício do backend
npm run test:frontend                  # testes unitários de máscaras + filtros (sem Electron)
npx electron desktop/teste-crud-real.js   # CRUD real (SendInput) em todas as telas, banco/Downloads em %TEMP%
npm run instalador                     # instalador Windows com Java embutido (ver docs/instalacao.md)
npm run publicar -- "novidades"        # põe o instalador na pasta de atualizações do Google Drive (a loja oferece ATUALIZAR)
python instalador/gerar-icone.py       # regera o emblema (instalador/icone.ico + frontend/assets/icone.png)
npx electron desktop/medir-layout.js --capturas   # rolagem/centralização das 18 telas em 3 resoluções
npx electron desktop/teste-hamburguer.js          # hambúrguer alinhado ao estreitar cada tela (17 telas × 12 larguras)
```

Os smokes e o teste de persistência exigem o jar já compilado e o frontend já buildado. smoke-real/smoke-dev movem mouse/teclado de verdade — não interagir com a máquina enquanto rodam.

## Arquitetura

**Electron (`desktop/main.js`)** escolhe porta livre, gera token aleatório por execução e faz `spawn("java", ["-jar", ...])` com `SERVER_PORT` e `FINDESK_API_TOKEN`; mostra `carregando.html` até o backend reportar prontidão real (SQLite + migrações), e encerra o backend junto com a janela (instância única). `preload.js` expõe ao renderer apenas IPC `findesk:*` (config porta/token, navegar, estado de inicialização, reiniciar backend, fechar). A navegação passa pelo processo principal: `findesk:navegar` valida a chave contra o `Map TELAS` (chave→arquivo HTML) antes de `loadFile` — **uma tela nova precisa ser registrada em `TELAS`**. `will-navigate`/`window.open` bloqueados. `FINDESK_DIAG_DIR` liga um log de diagnóstico de foco/entrada (usado pelo smoke-dev).

**Frontend (`frontend/`)** é multi-página: cada tela = `html/<tela>.html` (casca fina com `<body data-tela="...">` e CSP própria) + `ts/telas/<tela>.ts`. `ts/main.ts` é o único entry point do esbuild e despacha por `body.dataset.tela` com `import()` dinâmico (code splitting) — **tela nova também precisa de um `case` em `main.ts`**. Módulos compartilhados:
- `api.ts` — cliente HTTP para `127.0.0.1:<porta>` com header `X-FinDesk-Token`.
- `navegacao.ts` — pilha de voltar em `sessionStorage` (`irPara/voltar/menuPrincipal`).
- `navbar.ts` — navbar global fixa (barra desktop + hambúrguer); módulo ativo via `MODULO_DA_TELA`.
- `submenus-config.ts` + `telas/submenu.ts` — submenus são gerados por config, não por HTML.
- `dialogos.ts` — todos os pop-ups (`confirmar`, `confirmarExclusao`, `confirmarDuplicidade`, `aviso`, `sucesso`, `erro`...). **Nunca usar `window.alert/confirm/prompt`**: diálogos nativos causavam o bug de inputs mortos no Electron 33/Windows. Handlers de teclado dos forms devem checar `dialogoEstaAberto()` / `menuLateralAberto()`.
- `mascaras.ts` — máscaras (funções puras `limpar`/`montar` + ligação com o input) e validações de CPF/CNPJ (inclui CNPJ alfanumérico). Campo de moeda exibe "1.234,56" (o "R$" é rótulo ao lado). Testes em `desktop/teste-mascaras.js`.
- DOM somente via `createElement`/`textContent` (sem `innerHTML` com dados). Tailwind varre também `frontend/ts/**`, então classes podem estar no TS. Fontes são locais (offline, sem CDN).

**Backend (`backend/`, pacote `com.chaveiro`)**: `api/*Controller` → `service/*Service` → `repository/*Repository` (JDBC puro, PreparedStatements) → SQLite. `web/TokenFilter` rejeita com 401 requisições sem o token; `api/ApiExceptionHandler` mapeia as exceções de `service/` (`DadosInvalidosException`, `RecursoNaoEncontradoException`, `ConflitoIntegridadeException`, `PossivelDuplicataException`) para JSON padronizado. `database/ConnectionFactory` resolve o banco (`FINDESK_DB_PATH` ou `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\contas_a_pagar.db`) e aplica PRAGMAs (WAL, foreign_keys, busy_timeout) por conexão. `database/InicializadorBanco` (ApplicationRunner) faz backup pré-migração, roda `DatabaseInitializer` (migrações aditivas versionadas por `PRAGMA user_version`, `VERSAO_ATUAL`) e backup diário; `BackupService` usa `VACUUM INTO`. Testes usam `src/test/resources/application.properties`, que aponta para um banco aleatório em `backend/target/banco-testes/`.

**Legado**: o protótipo JavaFX antigo foi removido da raiz; está preservado na tag Git `legado-javafx`. `vba/` (fora do Git) contém as regras originais da planilha.

## Regras de domínio não óbvias

- Hierarquia de fontes: design = telas do Google Stitch (`docs/stitch/*.html`, `telas_referencia/`); regras de negócio = VBA original; plano de telas = `docs/plano-telas.md`.
- `status` de uma conta (PENDENTE/PAGO) é imutável via PUT; só muda pela baixa/estorno, que grava `pagamentos` + status na mesma transação (`UNIQUE(id_conta)` em pagamentos — pagamento integral único por conta).
- Duplicidade de conta segue o VBA (comparação restrita ao mês do vencimento); `forcar` pula apenas esse filtro, nunca validações/FKs/CHECKs.
- Recorrência gera 12 competências, preserva o dia (dia inexistente → último dia do mês), anti-duplicação por nome+vencimento; excluir recorrência remove só as contas geradas não pagas.
