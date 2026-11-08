const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("finDesk", {
  config: () => ipcRenderer.invoke("findesk:config"),
  navegar: (tela) => ipcRenderer.invoke("findesk:navegar", tela),
  estadoInicializacao: () => ipcRenderer.invoke("findesk:estado-inicializacao"),
  onInicializacao: (callback) =>
    ipcRenderer.on("findesk:inicializacao", (_evento, estado) => callback(estado)),
  reiniciarBackend: () => ipcRenderer.invoke("findesk:reiniciar-backend"),
  fecharAplicativo: () => ipcRenderer.invoke("findesk:fechar"),
});
