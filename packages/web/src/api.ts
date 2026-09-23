export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const isElectron = typeof window !== "undefined" && !!window.electronAPI;

/** In the browser, auth rides on the httpOnly `session` cookie (credentials:
 * "include" is enough). Inside Electron there's no shared cookie jar with the
 * backend in a meaningful way, so the token grabbed from the OAuth loopback is
 * sent explicitly as a Bearer header instead - see packages/desktop's preload/main. */
async function authHeader(): Promise<Record<string, string>> {
  if (!isElectron) return {};
  const token = await window.electronAPI!.getToken();
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
    credentials: "include",
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

/** Downloads a non-JSON endpoint (e.g. a CSV export) with the right auth attached.
 * A plain <a href> works for the web build (the session cookie rides along on a
 * top-level navigation under SameSite=Lax) but not inside Electron, which has no
 * cookie at all - only the Bearer token apiFetch already knows how to attach. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeader(),
    credentials: "include",
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
