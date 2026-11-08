# Active Context

## Foco Atual
**Escopo integral autorizado em execução — Módulo 3.4 (Todos os Cadastros) CONCLUÍDO (2026-11-08);
próximo: Módulo 3.5 (Inserir Conta).** Plano mestre registrado abaixo; execução incremental módulo
a módulo com checkpoints locais; push AGUARDA autorização.

### Navbar desktop (aguardando validação visual do usuário)
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

## Entrega 3.3 (Empresa — implementada, aguardando validação)
- **Implementada em 2026-11-07** (commit `6f554a4`, conforme `progress.md` "Fase 3"): cadastro em
  2 etapas com telefones (1FN), migração v5 `empresas`/`telefones_empresa`, validações de
  CNPJ/email/telefone, API `/api/empresas`; JUnit 80/80, smoke 246/246. Correção do launcher no
  mesmo commit. Substitui a pendência antiga que erroneamente indicava a 3.3 como não iniciada.

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
- `feature/entrega-3.1-sqlite-banco` (a partir de `feature/navbar-global` = `b349235`); HEAD = `637e44b`
  (fix das GSD e links do Memory Bank) — commits de preservação `ad6280f`/`d1558b3` intactos;
  história recente: Empresa `6f554a4` → boot/lazy `3a56669` → navbar `0c66453`/`fa22721` → skills `3fb01ba`/`c72fe78`/`637e44b`
- Working tree limpa (diagnóstico de governança de 2026-11-08 sem alterações de código)
- Branch à frente de `origin` em 5 commits — NADA publicado (push AGUARDA autorização)
- `main`/`develop`/`feature/navbar-global` preservadas

## Recuperação das GSD & Governança de Agentes (2026-11-08)
- Recuperadas e adaptadas funcionalmente as 3 skills GSD (`gsd-plan-phase`, `gsd-execute-phase`, `gsd-verify-work`) para o OpenCode, eliminando dependências do Claude Code e integrando-as ao Memory Bank e suíte de testes.
- Corrigida a skill `java-observability-logging` (removido JavaFX, adicionado Spring Boot 3.3, SLF4J, MDC, rotação de arquivos e proteção LGPD).
- Atualizado `AGENTS.md` na raiz com separação estrita entre Processo (GSD) e Conhecimento Técnico Especializado.
- Total de 23 skills funcionais ativas sob `.agents/skills/`.
- **Auditoria final (2026-11-08, 2ª passada):** estado real divergia do relatório — 3 correções aplicadas:
  (a) `gsd-execute-phase` referenciava `ask_question` (ferramenta do Antigravity/Claude) → substituída
  pela ferramenta `question` do OpenCode; (b) GSD Execute complementada com testes durante o
  desenvolvimento (checkpoint) e controle de progresso via `todowrite` (disponível no OpenCode);
  (c) links relativos `../../.memory-bank/` corrigidos para `../../../.memory-bank/` em `gsd-plan-phase`
  e `gsd-verify-work` (apontavam para `.agents/.memory-bank/` inexistente). Histórico Git auditado:
  as GSD só existem como stubs "desativadas" (3fb01ba) e versões recuperadas (c72fe78) — não há
  versão original completa no repositório; conteúdo útil reconstruído nas versões atuais.
  Validação de carregamento: 23/23 skills reconhecidas pelo OpenCode (frontmatters válidos),
  comandos referenciados existem (`backend/pom.xml`, `desktop/smoke*.js`, `npm run typecheck`),
  zero referências a ferramentas inexistentes, zero JavaFX fora da nota histórica do
  `project-architecture-map` (tag `legado-javafx`).

## Plano Mestre — ESCOPO INTEGRAL autorizado (2026-11-08)
> Usuário revogou a entrega única 3.4 e autorizou TODAS as telas/funcionalidades. Execução
> incremental módulo a módulo (GSD: planejar→executar→verificar), checkpoints locais, SEM push.

**Inventário — botões mortos a tornar funcionais:** Menu `inserir-conta`/`graficos` (provisórios);
Controle `todas-as-contas`/`pagos`; Cadastros `todos-os-cadastros`; Mensagens
`todas-as-mensagens`/`criar-nova-mensagem`; Recorrentes `todas-contas-recorrentes`/
`cadastrar-nova-recorrente`. Telas prontas: menu, 5 submenus, form-{banco,pagador,empresa},
navbar, carregando. Backend pronto: CRUD bancos/pagadores/empresas + backup + token.

**Decisões do usuário (2026-11-08, pergunta feita):** (1) Categoria = campo texto com sugestões
(datalist de categorias já usadas — sem cadastro novo); (2) Inserir Conta inclui Pagador (quem vai
pagar) + flag "boleto está na pasta"; (3) pagamento ÚNICO integral por conta (data/valor pago/
banco, 1:1, sem parciais — correção via edição); (4) recorrência com dia inexistente no mês AJUSTA
para o último dia (não pula).

**Fontes de regra (modelo não lê PNGs — triangulação):** `BRIEFING_PROJETO.md` (Inserir Conta =
Valor/Vencimento → Categoria/Fornecedor/NF), `docs/plano-telas.md` §2/§3, VBA
`vba/cod_vba_contas_a_pagar.txt` (regras extraídas): duplicidade na inserção (nome parecido +
data ±5d OU valor dif. ≤R$150; ou doc igual → confirma), baixa PAGO/PENDENTE idempotente,
vencidos −15..−1 e a vencer 0..10, mensagens com vigência (início/fim/dia semana), exclusão de
recorrente só remove não pagas, edição de conta com troca de mês.

**Ordem de módulos (dependências):**
1. **3.4 Todos os Cadastros** — tabela multi-filtro + painel de edição inferior + exclusão
   confirmada (frontend-only; APIs CRUD existem). [plano detalhado na seção anterior]
2. **3.5 Inserir Conta** — migração v7 `contas_a_pagar` (FKs empresa/pagador, categoria texto,
   nº doc, valor>0, vencimento, pasta, status PENDENTE/PAGO) + API `/api/contas` + form 2 etapas +
   filtro de duplicidade VBA.
3. **3.6 Boletos (Todas as Contas)** — tabela + pesquisa (nome/valor) + baixa rápida atômica
   (POST pagamentos → 1:1, 409 se duplicado) + painel de edição + DELETAR confirmado.
4. **3.7 Pagos (Tabela Verde)** — histórico (data/valor pago/banco), correção (PUT pagamento),
   revert para PENDENTE.
5. **3.8 Recorrentes** — migração `boletos_recorrentes` + form roxo (dia/valor/pagador/
   periodicidade MENSAL/BIMESTRAL/TRIMESTRAL/ANUAL) + geração de contas anti-duplicação +
   exclusão só não pagas + tabela reduzida.
6. **3.9 Mensagens** — migração `avisos` (início/fim/dia semana/título/mensagem) + form + tabela
   com filtros TODOS/ATIVOS/DIAS ÚTEIS/EXPIRADOS/CRONOLÓGICO + edição/exclusão.
7. **3.10 Gráficos + alertas Menu** — `/api/dashboard/resumo` (gastos por mês/categoria, filtros
   ESTE MÊS/ÚLTIMOS 3/ESTE ANO, IMPRIMIR) + alertas de vencimento no Menu (VBA regra 15/10).

**Regras transversais:** BigDecimal/NUMERIC monetário (zero float), PreparedStatements,
migrações aditivas versionadas, tests sempre `FINDESK_DB_PATH` temp, design neobrutalista
preservado, 3 resoluções, sem frameworks frontend, checkpoints Git locais por módulo (sem push).

## Plano — Entrega 3.4 "Todos os Cadastros" (planejada 2026-11-08 — AGUARDA AUTORIZAÇÃO)
> Planejamento GSD (`gsd-plan-phase`) concluído; NÃO executar sem autorização do usuário.
> Escopo: tabela multi-filtro (Empresas/Pagadores/Bancos) com busca, visualização/edição e exclusão
> com confirmação. Backend NÃO muda (CRUD completo já existe em `/api/{empresas|pagadores|bancos}`).

**Fatias verticais (ordem de dependência):**
1. **Plumbagem de navegação:** `"todos-cadastros"` na união `Tela` (`navegacao.ts`/`tipos.d.ts`),
   whitelist `TELAS` (`desktop/main.js`), dispatch (`main.ts`), `MODULO_DA_TELA` (`navbar.ts`),
   `destino: "todos-cadastros"` no botão `todos-os-cadastros` (`submenus-config.ts`, hoje sem destino),
   casca `todos-cadastros.html` (convenções `data-tela` + `dataset.pronto` + chunk ESM).
2. **Tabela multi-filtro:** filtro por tipo (segmentado Empresas/Pagadores/Bancos) + busca textual
   client-side (listas locais pequenas — sem endpoint de busca); colunas por tipo; estados
   loading/empty/error obrigatórios (`frontend-ui-engineering`); DOM seguro sem `innerHTML` com
   variáveis e delegação de eventos (`vanilla-typescript-dom`); neobrutalismo + breakpoints
   1536/768/480.
3. **Visualização + edição:** ação "Editar" por linha → form existente (`form-{banco,pagador,empresa}`)
   em modo edição via `sessionStorage` (id do registro), GET por id pré-preenche, PUT salva;
   design aprovado intacto (apenas modo edição); dirty-form reaproveitado.
4. **Exclusão com confirmação:** `window.confirm` → DELETE → 204 remove linha; 404/409 → mensagem
   amigável (hoje `telefones_empresa` faz `ON DELETE CASCADE`; 409 protege vínculos futuros de
   `contas_a_pagar`).
5. **Verificação:** JUnit (PUT/DELETE/cascata — complementar lacunas), smoke bloco
   todos-cadastros, smoke-real (clique/digitação real, editar/excluir, 2 ciclos),
   teste-persistencia (ciclo com edição/exclusão em `FINDESK_DB_PATH` temp), capturas
   `docs/responsivo/todos-cadastros-{1536x864,768x800,480x800}.png`.

**Arquivos previstos:** NOVOS `frontend/html/todos-cadastros.html`,
`frontend/ts/telas/todos-cadastros.ts`. MODIFICADOS: `api.ts` (listar/por id/atualizar/excluir),
`submenus-config.ts`, `navegacao.ts`, `tipos.d.ts`, `navbar.ts`, `main.ts`, `desktop/main.js`,
`telas/form-{banco,pagador,empresa}.ts` (modo edição), `desktop/smoke.js`, `desktop/smoke-real.js`,
`desktop/teste-persistencia.js`. BACKEND: inalterado (testes só se houver lacuna).

**Riscos:** (a) modo edição toca forms aprovados — mitigação: mínimo necessário, sem redesign;
(b) novas telas precisam seguir convenções `data-tela`/`dataset.pronto`/ESM ou o smoke quebra;
(c) smoke atual (246 testes) cobre navegação dos submenus — botão ganha destino e testes
atualizados; (d) exclusões reais só na UI operacional — testes sempre em banco temp.

**Critérios de aceitação:** `npm run typecheck` + `mvn compile` limpos; JUnit 100%; smoke sintético
com bloco completo (filtros, busca, empty/error, edição com pré-preenchimento+PUT, exclusão com
confirmação/cancelamento, 409 amigável, breakpoints, navbar, offline 0 URLs externas); smoke-real
2 ciclos aprovados; persistência fechar/reabrir com edição/exclusão; banco operacional intocado;
capturas nas 3 resoluções.

**Decisões pendentes do usuário:** (1) edição reutilizando os forms existentes em modo edição
(recomendado) vs modal/inline na tabela; (2) layout da aba "Todos" com colunas genéricas vs
exibição por tipo separada.

## Pendências
1. Validação do usuário: correção do Banco (instituição + Pix) + Entrega 3.2 (Pagador) + Entrega 3.3
   (Empresa) + navbar hover; capturas em `docs/responsivo/form-{banco,pagador}-{1536x864,768x800,480x800}.png`
2. Push ao GitHub — AGUARDA autorização explícita
3. Próxima entrega: **Todos os Cadastros** (tabela multi-filtro + edição) — planejamento GSD
   apresentado em 2026-11-08 (ver seção acima); NÃO executar sem autorização
