---
name: electron-desktop
description: Regras do processo principal Electron deste projeto — janela e foco no Windows, preload/IPC seguro, whitelist de telas, inicialização e encerramento do backend Java (porta dinâmica + token). Use ao mexer em desktop/main.js, desktop/preload.js, na inicialização, no foco da janela ou no ciclo de vida do backend.
---

# Electron desktop + ponte com o backend Java

Consolida `electron-desktop-lifecycle`, `desktop-electron-java-bridge` e a parte local de `desktop-security-guard`.

## Janela e foco (Windows)

- Crie com `show: false` e mostre só em `ready-to-show`. Depois chame `show()`, `moveTop()` (com `setAlwaysOnTop` true/false) e `focus()` + `webContents.focus()`. Reforce o foco em `did-finish-load`.
- **Nunca** use diálogos nativos (`window.alert/confirm/prompt`, `dialog.showMessageBox` em fluxo normal). Eles foram a causa raiz do bug de "inputs mortos": o Chromium não refaz o ciclo de foco depois de fechar um modal nativo. Use `frontend/ts/dialogos.ts`.
- **Instância única:** `app.requestSingleInstanceLock()`. Em `second-instance`, restaure e foque a janela existente.
- `FINDESK_DIAG_DIR` liga o log de diagnóstico de foco e entrada, usado por `desktop/smoke-dev.js`.

## Segurança do renderer

- `contextIsolation: true` e `nodeIntegration: false`. Bloqueie `setWindowOpenHandler` (deny) e `will-navigate`.
- O preload expõe só funções via `contextBridge` que chamam `ipcRenderer.invoke("findesk:*")`, nunca o `ipcRenderer` bruto.
- **Navegação:** o renderer pede `findesk:navegar(chave)` e o main valida a chave no `Map TELAS` antes do `loadFile`. **Tela nova = registrar em `TELAS`** (e em `frontend/ts/main.ts`).
- Valide todo argumento recebido em `ipcMain.handle`.
- CSP em cada HTML, com `connect-src` limitado a `127.0.0.1`.

## Backend como processo filho

- **Porta livre:** `net.createServer().listen(0, "127.0.0.1")`. Nunca fixe a 8080.
- **Token:** `crypto.randomBytes(24).toString("hex")` a cada execução, passado por `env` (`SERVER_PORT`, `FINDESK_API_TOKEN`) ao `spawn("java", ["-jar", backend/target/findesk-backend-0.1.0.jar])`, com `windowsHide: true`.
- **O token nunca** é gravado em disco, log ou commit.
- **Prontidão:** faça polling de `GET /api/status` (com token) até `inicializado`, com timeout. A tela `carregando.html` só sai quando o banco e a API estão prontos. Nada de timers fixos como critério.
- **Falha na subida:** mostre o erro com as opções "Tentar novamente" (`findesk:reiniciar-backend`) e "Fechar".
- **Encerramento:** em `before-quit` e `window-all-closed`, mate o processo filho. Se preciso, use `taskkill /pid <PID> /T /F` para não deixar processo órfão. Diferencie o encerramento voluntário de um crash do backend.

## Futuro (Fase 5: instalador e uso online)

- O JRE vai embutido via `jpackage`, e o caminho do `java` passa a ser o do runtime empacotado.
- Se houver login ou acesso remoto: senhas com Argon2id/BCrypt (nunca SHA/MD5), TLS 1.3 e tokens no Windows Credential Manager. Não implemente antes de ser pedido.
