import { contextBridge, ipcRenderer } from "electron";

// Auth-related IPC (startDiscordLogin/getToken/clearToken/onToken) used to
// live here - gone now that the app just loads the real website directly and
// logs in exactly like a browser tab (see main.ts). window.electronAPI still
// exists purely so the web app's TitleBar component can detect it's running
// inside Electron and draw its own window controls.
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
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
