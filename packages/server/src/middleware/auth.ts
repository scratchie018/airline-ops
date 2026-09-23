import { NextFunction, Request, Response } from "express";
import { Permission, hasPermission } from "shared";
import { verifySession } from "../services/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: import("shared").Role };
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

/** Accepts either an `Authorization: Bearer <token>` header (used by the desktop
 * app) or a `session` httpOnly cookie (used by the website) - same JWT either way. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = verifySession(token);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: "Not permitted" });
    }
    next();
  };
}
