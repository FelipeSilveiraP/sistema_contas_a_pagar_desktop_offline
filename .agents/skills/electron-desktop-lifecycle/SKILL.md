---
name: electron-desktop-lifecycle
description: >
  Diretrizes de ciclo de vida, janelas, foco e segurança no Electron para Windows.
  Garante foco de janela via ready-to-show, did-finish-load, single instance lock,
  IPC seguro (contextIsolation, contextBridge), bloqueio de navegação externa
  e otimização de inicialização.
triggers:
  - "electron"
  - "janela"
  - "foco"
  - "ready-to-show"
  - "contextBridge"
  - "ipcMain"
  - "BrowserWindow"
origin: "Autoral / Baseado na documentação oficial Electron (OpenJS Foundation) e padrões Windows do projeto"
license: "Autoral / Documentação Electron (OpenJS Foundation)"
---

# Electron Desktop Lifecycle & Window Management

Diretrizes para garantir inicialização confiável, foco garantido no Windows e segurança no processo principal do Electron.

## 1. Ciclo de Vida e Ativação de Janela (Windows)

No Windows, janelas criadas com `show: true` podem subir em segundo plano na ordem de z-order do sistema operacional, tornando os inputs HTML inacessíveis ("janela congelada").

### Regra de Criação Confiável:
1. **Sempre criar oculta:** `show: false`.
2. **Exibir apenas em `ready-to-show`:**
   ```javascript
   janela.once("ready-to-show", () => {
     janela.show();
     janela.setAlwaysOnTop(true);
     janela.moveTop();
     janela.setAlwaysOnTop(false);
     janela.focus();
     janela.webContents.focus();
   });
   ```
3. **Reforçar foco em `did-finish-load`:**
   ```javascript
   janela.webContents.on("did-finish-load", () => {
     if (!janela || janela.isDestroyed()) return;
     janela.focus();
     janela.webContents.focus();
   });
   ```

## 2. Instância Única (Single Instance Lock)

Evita processos concorrentes e conflitos de portas ou bancos de dados locais:
```javascript
const instanciaUnica = app.requestSingleInstanceLock();
if (!instanciaUnica) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
}
```

## 3. Segurança do Preload e IPC

1. **Isolamento de Contexto Obrigatório:**
   ```javascript
   webPreferences: {
     preload: path.join(__dirname, "preload.js"),
     contextIsolation: true,
     nodeIntegration: false,
   }
   ```
2. **Bloqueio de Novas Janelas e Navegação Não Autorizada:**
   ```javascript
   janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
   janela.webContents.on("will-navigate", (evento) => evento.preventDefault());
   ```
3. **Preload Estrito via `contextBridge`:**
   - Jamais expor o objeto `ipcRenderer` bruto no `window`.
   - Expor apenas métodos assíncronos explicitamente mapeados via `ipcRenderer.invoke()`.
   - Sanitizar e validar argumentos recebidos em `ipcMain.handle()`.

## 4. Otimização de Inicialização

1. Exibir tela leve de splash (`carregando.html`) imediatamente enquanto serviços pesados (como backend Java) inicializam em paralelo.
2. Não executar operações bloqueantes no loop de eventos do processo principal.
3. Carregar o menu principal apenas após confirmação explícita de prontidão do sistema.
