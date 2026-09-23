export {};

declare global {
  interface Window {
    // Only present when this page is loaded inside the Electron desktop app
    // (exposed via a contextBridge preload script - see packages/desktop/src/preload.ts).
    electronAPI?: {
      isElectron: true;
      startDiscordLogin: () => void;
      getToken: () => Promise<string | null>;
      clearToken: () => Promise<void>;
      onToken: (callback: (token: string) => void) => void;
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
