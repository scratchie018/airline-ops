import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { createServer, Server } from "node:http";
import { URL } from "node:url";
import { join } from "node:path";
import { clearToken, loadToken, saveToken } from "./tokenStore";

const API_URL = process.env.AIRLINE_OPS_API_URL || "http://localhost:4000";
const LOOPBACK_PORT = 4100;
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let loopbackServer: Server | null = null;

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

/** Starts (if not already running) a short-lived local HTTP server whose sole job
 * is catching the one redirect Discord/our backend sends back after login - the
 * standard loopback pattern desktop apps use for OAuth since they can't register a
 * custom redirect URI that a browser-based flow would otherwise use. Closes itself
 * once it's caught a token so it's not sitting open the rest of the session. */
function ensureLoopbackServer() {
  if (loopbackServer) return;

  loopbackServer = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${LOOPBACK_PORT}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const token = url.searchParams.get("token");
    res.writeHead(200, { "Content-Type": "text/html" });
    if (token) {
      saveToken(token);
      mainWindow?.webContents.send("auth:token-received", token);
      res.end("<html><body>Signed in - you can close this tab and return to Airline Ops.</body></html>");
    } else {
      res.end("<html><body>Login failed - no token received.</body></html>");
    }

    loopbackServer?.close();
    loopbackServer = null;
  });

  loopbackServer.listen(LOOPBACK_PORT);
}

ipcMain.handle("auth:start-login", () => {
  ensureLoopbackServer();
  shell.openExternal(`${API_URL}/auth/discord?client=desktop`);
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
