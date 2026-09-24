import { prisma } from "../db";

/** Short-lived handoff for desktop OAuth logins. The desktop app can't reliably
 * receive an inbound redirect on localhost (Windows Firewall, AV, or a port
 * conflict can silently block that), so instead it polls this store by a random
 * session id it generated before opening the browser. One-time read: the row
 * is deleted as soon as the desktop app collects it.
 *
 * Backed by Postgres rather than an in-memory Map on purpose - a free-tier
 * Render service can restart (a deploy, or just going back to sleep after 15
 * idle minutes) at any point between the browser showing "Signed in" and the
 * desktop app's next poll, which would silently wipe an in-memory store and
 * strand that login with no visible error. */

const TTL_MS = 5 * 60 * 1000;

export async function createDesktopSession(sessionId: string, token: string): Promise<void> {
  await prisma.desktopAuthSession.create({
    data: { id: sessionId, token, expiresAt: new Date(Date.now() + TTL_MS) },
  });
}

export async function consumeDesktopSession(sessionId: string): Promise<string | null> {
  const entry = await prisma.desktopAuthSession.findUnique({ where: { id: sessionId } });
  if (!entry) return null;
  await prisma.desktopAuthSession.delete({ where: { id: sessionId } }).catch(() => {
    // Already consumed by a concurrent poll - fine, whichever request got
    // here first already returned the token.
  });
  if (entry.expiresAt.getTime() < Date.now()) return null;
  return entry.token;
}

/** Sweeps rows nobody ever polled for (an abandoned login, or one that timed
 * out client-side) - called opportunistically rather than on a timer, since
 * this table sees very little traffic. */
export async function cleanupExpiredDesktopSessions(): Promise<void> {
  await prisma.desktopAuthSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
