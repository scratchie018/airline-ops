import { NextFunction, Request, Response } from "express";
import { Permission, Role, hasPermission } from "shared";
import { prisma } from "../db";
import { verifySession } from "../services/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string };
      /** Set by requireAirlineMembership - the caller's Role in the airline named
       * by the X-Airline-Id header, not carried in the session token since one
       * account can be a member of several airlines with different roles. */
      membership?: { id: string; airlineId: string; role: Role };
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  const cookieToken = req.cookies?.session;
  return cookieToken || null;
}

/** Both web and desktop send the session as an `Authorization: Bearer` header now
 * (see routes/auth.ts) - the cookie fallback is only here in case anything old is
 * still sending one, it's never set by current code. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = verifySession(token);
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

/** Resolves which airline the request is operating on and the caller's Role in
 * it, from the X-Airline-Id header the frontend sends on every request once an
 * airline is selected (see web/src/api.ts). Must run after requireAuth. */
export async function requireAirlineMembership(req: Request, res: Response, next: NextFunction) {
  const airlineId = req.header("X-Airline-Id");
  if (!airlineId) {
    return res.status(400).json({ error: "Missing X-Airline-Id header" });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_airlineId: { userId: req.user!.id, airlineId } },
  });
  if (!membership) {
    return res.status(403).json({ error: "Not a member of this airline" });
  }

  req.membership = { id: membership.id, airlineId: membership.airlineId, role: membership.role as Role };
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.membership) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!hasPermission(req.membership.role, permission)) {
      return res.status(403).json({ error: "Not permitted" });
    }
    next();
  };
}
