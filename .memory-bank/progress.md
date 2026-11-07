# Progress Tracking

## Fase 0 — Auditoria e planejamento (CONCLUÍDA)
- [x] Auditoria de segurança; chaves em `.env`; tag `legado-javafx`; commit de preservação `d1558b3`

## Fase 1 — Estrutura mínima funcional (CONCLUÍDA)
- [x] Menu Principal Stitch offline; backend Spring Boot (mock); Electron (contextBridge, instância única)
- [x] 4 JUnit; smoke; quincunx Stitch; responsividade 3/2/1 col

## Etapa 2 — Planejamento das telas (CONCLUÍDA, revisões v2/v3)
- [x] Inventário Stitch 29 telas (IDs completos); reconciliação 14+4+11=29
- [x] v2: requisitos obrigatórios × não aplicáveis; submenus sem SQLite/regras
- [x] v3: variantes Stitch mapeadas definitivamente; mapa de destinos com status (§2.3); estratégia agrupada (§5)

## Entregas incrementais
- [x] 1. Estrutura de navegação + Submenu Controle (APROVADA)
- [x] 2. Navegação completa + TODOS os submenus em entrega agrupada (AGUARDA APROVAÇÃO)
      — componente genérico de submenu + config central; Controle e Menu preservados
- [ ] 3. Pool financeiro (Cadastros, Inserir Conta, Boletos+baixa, Pagos, Recorrentes, Mensagens,
      Gráficos) — sequência a reavaliar/aprovar após Entrega 2

## Validação da Entrega 2 (2026-11-06)
- [x] Smoke `desktop/smoke.js`: 127/127 — abertura menu, API, segurança (Node/fs, whitelist 6 chaves,
      rejeição de caminho arbitrário), botões do Menu, atalhos F1–F4/1–4 + Esc/1/2/3, 5 submenus
      (entrada, rótulos, botões navega/provisório, VOLTAR), pilha profunda 2 níveis, repetição 3x,
      responsividade 6 páginas × 7 resoluções (colunas corretas, 0 overflow), offline 0 URLs externas,
      0 erros de console
- [x] JUnit regressão: 4/4; tsc + build CSS/TS OK (classes Tailwind geradas a partir do TS)
- [x] Capturas: docs/responsivo/{controle,cadastros,mensagens,recorrentes,novo-cadastro}-{1536x864,768x800,480x800}.png

## Pendências
- [ ] Aprovação visual do usuário (submenus)
- [ ] Re-auditoria de segurança + autorização de push (GitHub: NADA publicado ainda)
- [ ] Fase 2: SQLite + cadastros + BigDecimal (restaurar núcleo de b4fe64b seletivamente)
