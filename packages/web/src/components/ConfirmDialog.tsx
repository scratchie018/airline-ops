import { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Replaces the browser's native confirm() - same "block until answered"
 * ergonomics from the caller's side (`if (!(await confirm("..."))) return;`),
 * but themed to match the app and not a jarring native dialog. */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirmFn = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function answer(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => answer(false)}>
          <div
            className="bg-accent border rounded-xl shadow-lg shadow-black/40 p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {pending.title && <h2 className="font-semibold text-ink mb-2">{pending.title}</h2>}
            <p className="text-sm text-ink-muted mb-4">{pending.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => answer(false)}
                className="text-sm text-ink-muted hover:text-ink px-3 py-1.5 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => answer(true)}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg text-white ${
                  pending.danger ? "bg-tuired-500 hover:bg-tuired-600" : "bg-brand-500 hover:bg-brand-600"
                }`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmDialogProvider");
  return ctx;
}
