import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error";

interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

let nextId = 0;
const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextId;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), AUTO_DISMISS_MS);
  }, []);

  const state: ToastState = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={state}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg shadow-black/30 flex items-start gap-2 ${
              t.kind === "success"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-tuired-500/15 text-tuired-400 border-tuired-500/30"
            }`}
          >
            <i className={`fa-solid ${t.kind === "success" ? "fa-circle-check" : "fa-circle-exclamation"} mt-0.5`} />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              className="opacity-60 hover:opacity-100"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
