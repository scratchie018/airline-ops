import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ConfirmDialogProvider } from "./components/ConfirmDialog";
import TitleBar from "./components/TitleBar";
import { ToastProvider } from "./components/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* TitleBar renders nothing in the browser build - only matters for Electron,
        which has no native title bar (see packages/desktop/src/main.ts's frame:false). */}
    <div className="h-screen flex flex-col">
      <TitleBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <BrowserRouter>
          <ToastProvider>
            <ConfirmDialogProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ConfirmDialogProvider>
          </ToastProvider>
        </BrowserRouter>
      </div>
    </div>
  </React.StrictMode>
);
