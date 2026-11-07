const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("finDesk", {
  config: () => ipcRenderer.invoke("findesk:config"),
  navegar: (tela) => ipcRenderer.invoke("findesk:navegar", tela),
});
