export {};

declare global {
  interface Window {
    // Only present when this page is loaded inside the Electron desktop app
    // (exposed via a contextBridge preload script - see packages/desktop/src/preload.ts).
    // Just window-chrome controls now - the desktop app loads this website
    // directly and logs in exactly like a browser tab, no separate IPC auth path.
    electronAPI?: {
      isElectron: true;
      window: {
        minimize: () => void;
        maximizeToggle: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onStateChanged: (callback: (isMaximized: boolean) => void) => void;
      };
    };
  }
}
