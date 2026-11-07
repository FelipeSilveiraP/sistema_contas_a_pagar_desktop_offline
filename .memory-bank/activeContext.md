# Active Context

## Foco Atual
**Entrega 2 CONCLUÍDA — aguardando aprovação** (branch `feature/navegacao-submenus`, NENHUM commit, NENHUM push):
navegação completa + TODOS os submenus em entrega agrupada (Controle preservado + Cadastros, Novo
Cadastro, Mensagens, Recorrentes novos). Smoke 127/127 + JUnit 4/4. Capturas em `docs/responsivo/<tela>-*.png`.
`docs/plano-telas.md` revisado v3 (estratégia agrupada + mapa de destinos §2.3). Próximo passo: aprovação
→ Entrega 3 (pool financeiro, sequência a reavaliar com o usuário).

## Entrega 2 (submenus agrupados)
- Componente genérico `frontend/ts/telas/submenu.ts` (render de cards + atalhos + VOLTAR + provisório/navega)
  instanciado por `frontend/ts/submenus-config.ts` (config central: rótulos, cores, selos, SVGs, destinos)
- Submenus: `controle.html`, `cadastros.html`, `mensagens.html`, `recorrentes.html`, `novo-cadastro.html`
  (cascas finas; cards gerados por TS; Tailwind content inclui `frontend/ts/**`)
- Mapeamento definitivo variantes Stitch (verificado por htmlCode + pixels): 79967450→Mensagens
  (#ec4899/#f43f5e), 11751738→Cadastros (#ea580c/#f59e0b — style inline do Stitch prevalece),
  16202825→Recorrentes (#38bdf8/#7c3aed), 19211312→Novo Cadastro (#f59e0b/#dc2626/#16a34a)
- Destinos: CONTAS RECORRENTES→recorrentes, NOVO CADASTRO→novo-cadastro (navegam); demais provisórios
- Menu: CADASTROS/MENSAGENS agora navegam (visual preservado); INSERIR CONTA/GRÁFICOS provisórios
- `desktop/smoke.js` reescrito (data-driven): 127 verificações — todos os submenus, botões, VOLTAR,
  pilha profunda, repetição 3x, atalhos, responsividade 6 páginas × 7 resoluções, offline, console,
  whitelist (6 chaves + rejeição de caminhos arbitrários)

## Decisões
- Estratégia agrupada: tarefas semelhantes compartilham componentes/testes (§5 do plano revisado)
- Cores de Cadastros = cores renderizadas no screenshot do Stitch (inline style > classe CSS)
- Ícones dos cards em SVG local (design usava imgs remotas) — offline, identidade preservada
- Ícones de selo seguem o design (fonte Material Symbols local completa)

## Git
- `feature/navegacao-submenus` (nova, a partir de `feature/menu-responsivo`); `main`/`develop` intocadas
- Working tree: entregas 1+2 completas, sem commit (aguardando autorização)
- API Stitch: header `X-Goog-Api-Key` (parâmetro `?key=` descontinuado)

## Pendências
1. Aprovação visual do usuário (5 submenus + capturas)
2. Entrega 3: pool financeiro (Cadastros → Inserir Conta → Boletos → Pagos → Recorrentes → Gráficos)
   — sequência a reavaliar/aprovar
3. Re-auditoria de segurança + autorização de push
