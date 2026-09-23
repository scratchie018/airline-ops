import jwt from "jsonwebtoken";
import { Role } from "shared";
import { env } from "../env";

export interface SessionPayload {
  userId: string;
  role: Role;
}

const SESSION_TTL = "7d";

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.jwtSecret) as SessionPayload;
}
