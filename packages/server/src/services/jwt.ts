import jwt from "jsonwebtoken";
import { env } from "../env";

// No Role here anymore - a user's role is per-airline (Membership), not a
// single global thing a session token can carry. requireAirlineMembership
// looks it up fresh per-request from the X-Airline-Id header instead.
export interface SessionPayload {
  userId: string;
}

const SESSION_TTL = "7d";

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, env.jwtSecret) as SessionPayload;
}
