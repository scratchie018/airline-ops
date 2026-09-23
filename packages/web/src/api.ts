export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const isElectron = typeof window !== "undefined" && !!window.electronAPI;

const WEB_TOKEN_KEY = "airline_ops_token";

/** Web build's equivalent of the desktop app's encrypted token file - just
 * localStorage, scoped to this origin. Not as hardened as Electron's safeStorage,
 * but this is the standard approach for a browser SPA talking to a separate API
 * origin (see routes/auth.ts for why a cookie doesn't work here). */
export function setWebToken(token: string) {
  localStorage.setItem(WEB_TOKEN_KEY, token);
}
export function clearWebToken() {
  localStorage.removeItem(WEB_TOKEN_KEY);
}
function getWebToken(): string | null {
  return localStorage.getItem(WEB_TOKEN_KEY);
}

/** Both web and desktop authenticate the same way now: a Bearer token, stored
 * locally (localStorage for web, an encrypted file for Electron - see
 * packages/desktop's tokenStore.ts) and attached to every request. */
async function authHeader(): Promise<Record<string, string>> {
  const token = isElectron ? await window.electronAPI!.getToken() : getWebToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ? JSON.stringify(body.error) : message;
    } catch {
      // response wasn't JSON, fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Downloads a non-JSON endpoint (e.g. a CSV export), attaching the same Bearer
 * token apiFetch uses. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function startDiscordLogin() {
  if (isElectron) {
    window.electronAPI!.startDiscordLogin();
  } else {
    window.location.href = `${API_URL}/auth/discord`;
  }
}
