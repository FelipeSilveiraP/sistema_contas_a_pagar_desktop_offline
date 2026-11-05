const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("finDesk", {
  config: () => ipcRenderer.invoke("findesk:config"),
});
