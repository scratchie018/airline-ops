/** Short-lived, in-memory handoff for desktop OAuth logins. The desktop app can't
 * reliably receive an inbound redirect on localhost (Windows Firewall, AV, or a
 * port conflict can silently block that), so instead it polls this store by a
 * random session id it generated before opening the browser. One-time read: the
 * token is deleted as soon as the desktop app collects it. */

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  token: string;
  expiresAt: number;
}

const sessions = new Map<string, Entry>();

export function createDesktopSession(sessionId: string, token: string) {
  sessions.set(sessionId, { token, expiresAt: Date.now() + TTL_MS });
}

export function consumeDesktopSession(sessionId: string): string | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  sessions.delete(sessionId);
  if (entry.expiresAt < Date.now()) return null;
  return entry.token;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (entry.expiresAt < now) sessions.delete(id);
  }
}, 60 * 1000).unref();
