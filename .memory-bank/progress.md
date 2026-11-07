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
- [x] 3.1. Fundação SQLite + Cadastro de Banco (CONCLUÍDA — aguardando validação do usuário)
      — SQLite WAL + migrações + backup/restauração, API `/api/bancos`, form Banco (Stitch), nome oficial
- [ ] 3.2–3.10. Pagador, Empresa, Todos os Cadastros, Inserir Conta, Boletos, Pagos, Recorrentes,
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

## Pendências
- [ ] Validação do usuário na Entrega 3.1 (conferir form-banco contra a tela Stitch real)
- [ ] Iniciar Entrega 3.2 (Pagador) — SOMENTE após autorização do usuário
- [ ] Push ao GitHub (AGUARDA autorização explícita; nada publicado ainda)
