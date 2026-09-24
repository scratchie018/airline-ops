export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const isElectron = typeof window !== "undefined" && !!window.electronAPI;

const WEB_TOKEN_KEY = "airline_ops_token";
const CURRENT_AIRLINE_KEY = "airline_ops_current_airline";

/** Which airline every airline-scoped request is sent for - sent as the
 * X-Airline-Id header (see server/src/middleware/auth.ts). A plain localStorage
 * value rather than anything in the session token, since one Discord account
 * can be a member of several airlines and switching between them should be
 * instant and local, not a round trip to re-mint a token. */
export function getCurrentAirlineId(): string | null {
  return localStorage.getItem(CURRENT_AIRLINE_KEY);
}
export function setCurrentAirlineId(id: string) {
  localStorage.setItem(CURRENT_AIRLINE_KEY, id);
}
export function clearCurrentAirlineId() {
  localStorage.removeItem(CURRENT_AIRLINE_KEY);
}

/** localStorage, scoped to this origin - the same mechanism whether this page
 * is open in a real browser or inside the desktop app's Electron window (it's
 * just this website loaded there too, with its own persistent profile, see
 * packages/desktop/src/main.ts). Not as hardened as a native OS keychain,
 * but the standard approach for a browser SPA talking to a separate API
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

function authHeader(): Record<string, string> {
  const token = getWebToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function airlineHeader(): Record<string, string> {
  const id = getCurrentAirlineId();
  return id ? { "X-Airline-Id": id } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeader(),
    ...airlineHeader(),
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
    headers: { ...authHeader(), ...airlineHeader() },
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
  window.location.href = `${API_URL}/auth/discord`;
}
