import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import { join } from "node:path";

// The desktop app is just the real website loaded in a Chromium shell now -
// no bundled copy of the site, no separate OAuth flow. That used to be a
// custom loopback-server-then-polling dance to hand a login token back to
// this process, which kept breaking in new ways (Windows Firewall blocking
// the loopback listener, then a Render restart wiping the polling handoff
// mid-login) because it was a fundamentally different, custom-built path
// from the one the website itself already uses successfully every day.
// Pointing this window at the live site means login is the exact same
// redirect-to-Discord-and-back flow a browser tab gets, with the token
// landing in this window's own persistent localStorage - nothing left to
// break independently of the website.
const WEB_URL = process.env.AIRLINE_OPS_WEB_URL || "https://airline-ops-web.onrender.com";
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 820,
    minHeight: 560,
    // No native title bar/menu bar - the web UI draws its own (see TitleBar.tsx),
    // which is why every window-control action (minimize/maximize/close) has to
    // be wired up manually below instead of coming for free from the OS chrome.
    frame: false,
    backgroundColor: "#0f1021",
    icon: join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:state-changed", true));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:state-changed", false));

  // Discord's OAuth consent page opens its next step as a new window/tab
  // rather than a plain same-page redirect - Electron's default response to
  // that (silently deny the popup, or in some configurations hand it to the
  // OS's default browser) is exactly the "the app opens in Chrome, login
  // finishes there instead of coming back to the app" symptom reported. This
  // intercepts every such attempt and just navigates this one window to it
  // instead of ever spawning a second window - genuinely external links
  // (nothing in this app currently, but a future docs/support link, say)
  // still get handed to the system browser rather than swallowed into the
  // app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const ownDomains = ["discord.com", new URL(WEB_URL).hostname, "airline-ops-api.onrender.com", "localhost"];
    const isOwnFlow = ownDomains.some((host) => {
      try {
        return new URL(url).hostname.endsWith(host);
      } catch {
        return false;
      }
    });
    if (isOwnFlow) mainWindow?.loadURL(url);
    else shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(isDev ? "http://localhost:5173" : WEB_URL);
}

// Window controls for the custom titlebar - with frame:false there's no native
// minimize/maximize/close, so the renderer's buttons call these instead.
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize-toggle", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

app.whenReady().then(() => {
  // Removes the native File/Edit/View/Window/Help menu bar Electron shows by
  // default - the custom titlebar replaces it entirely, that bar left over on
  // top of it would look broken/redundant.
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
