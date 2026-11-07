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
- [x] 2.1. Barra de navegação global responsiva (APROVADA — commit de preservação local; sem push)
      — barra desktop 6 botões + menu lateral hambúrguer→X + véu; estabilidade dos cartões comprovada
- [ ] 3. Pool financeiro (Cadastros, Inserir Conta, Boletos+baixa, Pagos, Recorrentes, Mensagens,
      Gráficos) — sequência a reavaliar/aprovar

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
      sem chave real; token API é `dev-token-local` via env `FINDESK_API_TOKEN` (loopback 127.0.0.1)
- [x] Regressão final: `npm run build` (tsc + tailwind + esbuild) OK; JUnit 4/4 OK

## Pendências
- [ ] Iniciar Entrega 3.1 (fundação SQLite + Cadastro de Banco) — SOMENTE após autorização do usuário
- [ ] Push ao GitHub (AGUARDA autorização explícita; nada publicado ainda)
- [ ] Sequência Fase 3 (3.2+): Pagador → Empresa → Tabela Todos os Cadastros → Inserir Conta →
      Boletos/baixa → Pagos → Recorrentes → Mensagens → Gráficos (uma entrega por vez)
