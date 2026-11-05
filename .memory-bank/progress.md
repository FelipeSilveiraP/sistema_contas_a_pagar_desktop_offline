# Progress Tracking

## Fase 0 — Auditoria e planejamento (CONCLUÍDA)
- [x] Auditoria de segurança: 6 segredos em 5 arquivos, nenhum no histórico/GitHub; .gitignore reforçado
- [x] Chaves migradas para `.env` (3 scripts Stitch) + teste de conexão OK
- [x] Tag `legado-javafx` (b4fe64b); commit de preservação `d1558b3` em `develop`

## Fase 1 — Estrutura mínima funcional (CONCLUÍDA localmente)
- [x] HTML original do Menu Principal baixado do Stitch e adaptado a 100% offline (fontes WOFF2 locais, Tailwind CSS estático — sem CDN)
- [x] Backend Spring Boot: `/api/status`, `/api/contas` (mock), token por boot, 127.0.0.1, porta dinâmica
- [x] Frontend TypeScript puro (api.ts separado de ui/main) compilado com esbuild + typecheck
- [x] Electron: spawn/kill do jar, espera de health, instância única, preload com contextBridge
- [x] Testes: 4 JUnit (401/200), tsc, build CSS/TS, smoke test completo
- [x] Smoke: janela "…Menu Principal - API OK", 3 contas de teste recebidas, porta 62134
- [x] Instância única OK; encerramento por WM_CLOSE → 0 processos residuais
- [x] Offline: 0 URLs externas de rede; scan de segredos nos novos arquivos: 0

## Pendências
- [ ] Validação visual do usuário (resolução real do monitor)
- [ ] CSP do Electron
- [ ] Re-auditoria de segurança + autorização de push (GitHub: NADA publicado ainda)
- [ ] Fase 2: SQLite + cadastros + BigDecimal (restaurar núcleo de b4fe64b seletivamente)
