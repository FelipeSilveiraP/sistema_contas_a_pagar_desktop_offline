# Progress Tracking

## Fase 0 — Auditoria e planejamento (CONCLUÍDA)
- [x] Auditoria de segurança; chaves em `.env`; tag `legado-javafx`; commit de preservação `d1558b3`

## Fase 1 — Estrutura mínima funcional (CONCLUÍDA)
- [x] Menu Principal Stitch offline; backend Spring Boot (mock); Electron (contextBridge, instância única)
- [x] 4 JUnit; smoke; quincunx Stitch; responsividade 3/2/1 col

## Etapa 2 — Planejamento das telas (CONCLUÍDA, revisões v2/v3/v4)
- [x] Inventário Stitch 29 telas (IDs completos); reconciliação 14+4+11=29
- [x] v2: requisitos obrigatórios × não aplicáveis; v3: variantes mapeadas + §2.3 + estratégia agrupada
- [x] v4: componente de navegação global documentado (§4.1)

## Entregas incrementais
- [x] 1. Estrutura de navegação + Submenu Controle (APROVADA)
- [x] 2. Navegação completa + todos os submenus agrupados (APROVADA — commit `f4fcbaf`)
- [x] 2.1. Barra de navegação global responsiva (APROVADA — commit `b349235`)
- [x] 3.1. Fundação SQLite + Cadastro de Banco (APROVADA tecnicamente — aguardando validação visual)
      — SQLite WAL + migrações + backup/restauração, API `/api/bancos`, form Banco (Stitch), nome oficial
- [x] 3.2. Cadastro de Pagador (IMPLEMENTADA — aguardando validação do usuário) — nome/CPF/função,
      migração v3 `pagadores`, API `/api/pagadores`, form-pagador conectado ao botão/atalho 2
- [x] Governança de Agentes & Recuperação das GSD (CONCLUÍDA — 2026-11-08) — 3 GSD recuperadas
      e adaptadas ao OpenCode, java-observability-logging atualizada para Spring Boot/SLF4J,
      AGENTS.md alinhado (Processo GSD vs Conhecimento Técnico), 23 skills funcionais ativas.
- [x] Auditoria final das skills (2026-11-08, 2ª passada) — divergências do relatório corrigidas:
      `ask_question`→`question` (gsd-execute), testes durante desenvolvimento + `todowrite`
      (controle de progresso), links `../../../.memory-bank/` corrigidos (gsd-plan/gsd-verify);
      carregamento validado 23/23 (frontmatters, comandos reais, zero ferramentas inexistentes);
      histórico Git comparado (stubs 3fb01ba vs recuperadas c72fe78 — sem versão original completa
      no repo); java-observability-logging confirmada sem JavaFX.
- [ ] 3.3–3.10. Empresa, Todos os Cadastros, Inserir Conta, Boletos, Pagos, Recorrentes,
      Mensagens, Gráficos — NÃO iniciar sem autorização (uma entrega por vez)

## Validação da Entrega 2.1 (2026-11-07; correção VOLTAR no painel revalidada)
- [x] Smoke `desktop/smoke.js`: 199/199 — ordem dos 6 botões (barra e painel), destinos
      reais/provisórios, destaque ativo por cor oficial (pixel-verificado), VOLTAR com histórico
      (barra e painel), VOLTAR sem histórico → Menu (fallback seguro), histórico entre módulos via
      painel, MENU PRINCIPAL, hambúrguer→X (matrizes ±45°), X/fora/ESC/auto-fechar, cliques
      bloqueados no fundo (elementFromPoint), abrir/fechar 5x, estabilidade de cartões (rects
      idênticos em 480/600/768, telas de 2–3 cartões, simetria central), breakpoints barra/hambúrguer
      em 7 resoluções, ligaturas Material Symbols, offline 0 URLs, 0 erros de console, whitelist
- [x] Regressão: JUnit 4/4; tsc + build CSS/TS; atalhos F1–F4/1–4 + Esc/1/2/3; Menu intocado
- [x] Inspeção visual por pixel-sampling: ícones laranja/rosa/verde na barra, ativo azul #38BDF8,
      véu escurece fundo (174→110), painel retângulo único branco+preto, hambúrguer 3 linhas
- [x] Capturas: docs/responsivo/nav-{barra-desktop-1536x864, menu-fechado-480x800,
      menu-aberto-480x800, menu-aberto-768x800}.png + <tela>-{1536x864,768x800,480x800}.png

## Auditoria final da Entrega 2.1 (2026-11-07)
- [x] Diff dos 28 arquivos modificados + 5 novos auditado (navbar, CSS, HTMLs, smoke, docs)
- [x] Segurança: 0 credenciais no repo; `.env`/`vba/`/scripts de prototipação git-ignored; `.env.example`
      sem chave real; (posteriormente na 3.1: default `dev-token-local` removido — token aleatório
      por inicialização via `FINDESK_API_TOKEN`)
- [x] Regressão final: `npm run build` (tsc + tailwind + esbuild) OK; JUnit 4/4 OK

## Validação da Entrega 3.1 (2026-11-07)
- [x] JUnit 35/35 — CRUD Banco, validações por campo, 404, FK→409, SQL injection inofensivo,
      persistência ao reabrir, transações; backup/restauração (`VACUUM INTO`, integridade, rotação);
      API MockMvc (201/200/204/400/404/409) + segurança de token (válido/ausente/inválido)
- [x] Smoke `desktop/smoke.js`: 220/220 — regressão completa (navbar, submenus, atalhos, estabilidade,
      responsividade, offline) + form Banco (campos, validações, save/feedback, CRUD via API,
      dirty-form VOLTAR/CANCELAR/ESC, fluxo Menu→Cadastros→Novo Cadastro→Banco, breakpoints da navbar)
- [x] Persistência com reinício real (`desktop/teste-persistencia.js`): 8/8 — cadastra fictício,
      encerra processo, reabre, confere dados intactos, remove e verifica token ausente dos logs
- [x] Auditoria final: diff auditado, 0 credenciais, sem bancos versionados, build/tsc/esbuild OK
- [x] Capturas: `docs/responsivo/form-banco-{1536x864,768x800,480x800}.png`

## Validação final da Entrega 3.1 (2026-11-07)
- [x] Implementação técnica APROVADA pelo usuário (condicionada apenas à validação visual do form-banco)
- [x] Preservar sem alterações: API REST, SQLite, regras de validação, testes, backup/restauração,
      navbar global, responsividade, nome oficial do aplicativo
- [x] Regra permanente registrada: testes automatizados com bancos temporários/isolados via
      `FINDESK_DB_PATH`; sem dados de teste no banco operacional; sem operações destrutivas nele
- [x] Falha Stitch (404) registrada; configuração MCP preservada — sem mudanças de credenciais/config
- [x] `ad6280f` preservado em `feature/entrega-3.1-sqlite-banco`; sem push; `main` intocada
- [ ] Aguardar avaliação visual do usuário (comparação com design Stitch) → somente ajustes pontuais

## Correção do Banco + início da Fase 3 (2026-11-07)
- [x] Banco reduzido a instituição (obrigatória) + chave Pix (opcional) — removidos código bancário,
      agência e conta; migração v2 reconstrói tabela preservando id/instituição/chavePix dos dados
- [x] Backend (model/repo/service/controller/API), frontend (html/ts/api) e validações atualizados
- [x] JUnit 33/33 (inclui teste de preservação v1→v2); smoke 220/220; persistência 8/8 —
      `teste-persistencia.js` agora usa `FINDESK_DB_PATH` em temp (regra de isolamento)
- [x] Capturas form-banco regeneradas (1536x864/768x800/480x800)
- [x] Levantamento do Pagador (3.2) apresentado: plano-telas (nome/CPF/função) × DER legado PF/PJ
      × VBA (nome do responsável); aguardando aprovação do usuário

## Entrega 3.2 — Pagador (2026-11-07)
- [x] Escopo aprovado via pergunta: simplista (nome, CPF, função=cargo); DER PF/PJ legado descartado
- [x] Migração v3 (aditiva) + model/repo/service/controller + API `/api/pagadores`
- [x] Validações: nome 2–120, CPF obrigatório com dígitos verificadores (espelhado no frontend),
      função opcional ≤60; CPF normalizado para dígitos
- [x] form-pagador.html/.ts (vermelho `#dc2626`, navbar CADASTROS, dirty-form, feedback);
      botão + atalho 2 de Novo Cadastro conectados (submenu-config, navbar, main.ts, main.js)
- [x] JUnit 56/56 (PagadorServiceTest 13, PagadorApiTest 10 novos); smoke 232/232 (bloco form-pagador:
      campos, validações, save/feedback, CRUD via API, atalho 2/Escape, breakpoints navbar);
      persistência 11/11 (pagador no ciclo fechar/reabrir); todos os testes em bancos temporários
- [x] Capturas: `docs/responsivo/form-pagador-{1536x864,768x800,480x800}.png`

## Boot + lazy loading (2026-11-07)
- [x] Diagnóstico com marcos `[startup]` (sem tokens): ANTES janela visível só +9,4s (backend
      primeiro); DEPOIS janela +0,9s com tela de carregamento; menu liberado por prontidão real
- [x] `carregando.html`/`carregando.ts` (neobrutalista, spinner CSS nativo) + estado de erro com
      Tentar novamente/Fechar; liberação somente com API respondendo `inicializado=true` (SQLite ok)
- [x] Lazy loading ESM: esbuild `--splitting` (chunks por tela; app.js 1,2KB), `type="module"` nos
      HTMLs; ESM em `file://` + CSP validado; `dataset.pronto` sinaliza componentes prontos
- [x] Migration v6: índices `idx_pagadores_nome`, `idx_empresas_razao`; JUnit com banco aleatório
      por execução (isolamento); `aguardarBackend` gateado por `inicializado`
- [x] smoke-boot.js (entrada real, 2 ciclos): 17/17 — carregamento, erro, cliques/digitação
      imediatos nos 3 forms, TAB, foco, capturas `carregando-{1,2}.png`; smoke 246/246,
      smoke-real 18/18×2; 0 órfãos; ~361MB (Electron+Java em uso)
- [ ] Próximo: Todos os Cadastros (tabela multi-filtro + edição) → Inserir Conta → demais

## Fase 3 — correção crítica + módulos (2026-11-07)
- [x] ETAPA 1: causa raiz dos inputs identificada (janela sem ativação/z-order) e corrigida em
      `criarJanela`; launcher `EXECUTAR_SISTEMA.bat` corrigido (abria JavaFX legado)
- [x] Regressão de entrada real `desktop/smoke-real.js` + `entrada-real.ps1` (SendInput):
      18/18 × 2 ciclos (clique/digitação/TAB/edição/navbar/bloqueios/relaunch)
- [x] Banco simplificado (instituição + Pix, migração v2) e Pagador (nome/CPF opcional validado/
      função ≤100, migrações v3–v4) — commit `cd9e95a`
- [x] Empresa (2 etapas + telefones 1FN, migração v5 `empresas`/`telefones_empresa`, CNPJ/email/
      telefone validados, API `/api/empresas`) — JUnit 80/80, smoke 246/246

## Pendências
- [ ] Todos os Cadastros (tabela multi-filtro + edição)
- [ ] Inserir Conta (2 etapas), Controle, Pagamentos, Pagos, Recorrentes, Mensagens, Gráficos
- [ ] Push ao GitHub (AGUARDA autorização; nada publicado)

## Navbar desktop redesenhada (2026-11-08)
- [x] Design de referência do usuário implementado em `navbar.ts` + `tailwind.input.css` (barra
      unida, borda 3px, sombra rígida 6px, seta VOLTAR, quadrados de ícones coloridos SVG,
      ativo azul #2165EF, hover #eee, focus-visible, compacto ≤1100px e em páginas de 2 botões)
- [x] Breakpoint barra/hambúrguer unificado em 851px; painel compacto preservado (VOLTAR primeiro,
      X/ESC/clique fora, véu, estabilidade dos cartões); `data-nav`/histórico reutilizados
- [x] Regressões: smoke 246/246 (ordem, destaque ativo, breakpoints, overflow), smoke-real
      APROVADO, smoke-boot APROVADO; capturas nav-{1920x1080,1536x864,1280x720,960x540} + compacto
- [ ] Aguardando validação visual do usuário

## Navbar: hover por módulo, sem cor fixa (2026-11-08)
- [x] Removido o azul fixo do módulo ativo (CADASTROS ficava constantemente azul nas telas-filhas);
      botões agora BRANCOS por padrão e hover pinta com a cor do botão respectivo do Menu
      (MENU `#FFE600`, CADASTROS `#FF8400`, CONTROLE `#38BDF8`, MENSAGENS `#FF5E89`, GRÁFICOS
      `#00FF66`, VOLTAR neutro) — CSS por `data-nav`, `aria-current` mantido sem efeito visual
- [x] Hover verificado com mouse REAL do Windows (smoke-real): branco → cor no hover → branco ao
      sair; captura `nav-hover-cadastros.png`; smoke 246/246 + smoke-real 2 ciclos APROVADO
- [ ] Aguardando validação visual do usuário
