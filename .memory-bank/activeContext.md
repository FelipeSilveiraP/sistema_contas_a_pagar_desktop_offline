# Active Context

## Foco Atual
**Fase 1 do FinDesk CONCLUÍDA localmente** (aguardando validação visual do usuário e autorização de publicação): Electron + Menu Principal original do Stitch offline + backend Spring Boot com API REST local autenticada.

## Estrutura Atual (branch `develop`)
- `frontend/` — `html/menu.html` (HTML original do Stitch, offline), `css/` (fonts.css local + tailwind.input), `ts/` (api.ts/main.ts TS puro), `assets/fonts/` (10 WOFF2, 1,2 MB), `dist/` gerado (tailwind.css + app.js, ignorado pelo git)
- `backend/` — Spring Boot 3.3.5 (`com.chaveiro`): StatusController, ContasController (mock), TokenFilter (`X-FinDesk-Token`), CorsConfig (origem `null`/localhost), ApiExceptionHandler; jar `findesk-backend-0.1.0.jar`
- `desktop/` — Electron `main.js` (porta dinâmica + token por boot, spawn/kill do jar, instância única) + `preload.js` (contextBridge)
- Raiz — `package.json` (typescript, esbuild, tailwindcss+forms+container-queries, electron), `tailwind.config.js`, `tsconfig.json`
- Legados preservados: `src/`, `pom.xml` (menu JavaFX), tag `legado-javafx` → `b4fe64b`

## Git
- `main` = `origin/main` = `b4fe64b` (intocada, sem push)
- `develop`: commit preservação `d1558b3` + commit Fase 1
- Credenciais: `.env` local (ignorado) + `.env.example`; 3 scripts Stitch migrados; `mcp_config.json` intocado (uso autorizado, ignorado)

## Pendências Fase 1
1. Validação visual do usuário (resolução real da empresa; provisório 1920×1080)
2. CSP no Electron (aviso de segurança do Chromium)
3. Re-auditoria de segurança + autorização para push (não publicado nada ainda)
