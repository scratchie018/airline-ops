import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Permission, User, hasPermission } from "shared";
import { apiFetch, clearWebToken, isElectron } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    // Desktop: the Electron main process fires this once the OAuth loopback
    // callback lands and it's stashed a fresh token - refetch /auth/me now that
    // apiFetch will actually have a token to send.
    if (isElectron) {
      window.electronAPI!.onToken(() => refresh());
    }
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    if (isElectron) await window.electronAPI!.clearToken();
    else clearWebToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        can: (permission) => (user ? hasPermission(user.role, permission) : false),
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
