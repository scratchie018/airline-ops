import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  startDiscordLogin: () => ipcRenderer.invoke("auth:start-login"),
  getToken: () => ipcRenderer.invoke("auth:get-token"),
  clearToken: () => ipcRenderer.invoke("auth:clear-token"),
  onToken: (callback: (token: string) => void) => {
    ipcRenderer.on("auth:token-received", (_event, token: string) => callback(token));
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    onStateChanged: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on("window:state-changed", (_event, isMaximized: boolean) => callback(isMaximized));
    },
  },
});
