import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { clearToken, loadToken, saveToken } from "./tokenStore";

const API_URL = process.env.AIRLINE_OPS_API_URL || "https://airline-ops-api.onrender.com";
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let pollTimer: NodeJS.Timeout | null = null;

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
    // Reuses the icon Vite already copied into web-dist/ (from web/public/icon.png)
    // rather than a separate copy step - sets the runtime taskbar/title-bar icon on
    // Linux/Windows (the packaging icon in package.json's build.icon is separate -
    // that one's for the installer/desktop-file, this is for the live window).
    icon: join(__dirname, "../web-dist/icon.png"),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:state-changed", true));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:state-changed", false));

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // web-dist is a copy of packages/web/dist made by the "predist" build step
    // (see package.json) - electron-builder's `files` glob can't reach outside
    // this package's own directory with `../`, so the website has to be copied
    // in locally before packaging rather than referenced from its real location.
    mainWindow.loadFile(join(__dirname, "../web-dist/index.html"));
  }
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Opens the system browser for Discord login, then polls the API for the
 * resulting token instead of running a local server to catch a redirect.
 *
 * This used to be a localhost HTTP server (the standard OAuth loopback pattern),
 * but that means the desktop app has to successfully *accept an inbound
 * connection* on the user's machine - something Windows Firewall, antivirus, or
 * a port already in use by something else can silently block, with no useful
 * error surfaced anywhere. Polling only ever makes outbound HTTPS requests, the
 * same kind every other API call in this app already makes successfully, so
 * there's no separate networking path that can be blocked. */
function startLogin() {
  const sessionId = randomUUID();
  shell.openExternal(`${API_URL}/auth/discord?client=desktop&session=${sessionId}`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (Date.now() > deadline) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      mainWindow?.webContents.send("auth:login-timed-out");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/session/${sessionId}`);
      if (res.status !== 200) return;
      const data = (await res.json()) as { ready: boolean; token?: string };
      if (data.ready && data.token) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        saveToken(data.token);
        mainWindow?.webContents.send("auth:token-received", data.token);
      }
    } catch {
      // Transient network hiccup - just try again on the next tick.
    }
  }, POLL_INTERVAL_MS);
}

ipcMain.handle("auth:start-login", () => {
  startLogin();
});

ipcMain.handle("auth:get-token", () => loadToken());

ipcMain.handle("auth:clear-token", () => clearToken());

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
