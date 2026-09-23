import { Router } from "express";
import jwt from "jsonwebtoken";
import { Role } from "shared";
import { prisma } from "../db";
import { env } from "../env";
import {
  buildAuthorizeUrl,
  discordAvatarUrl,
  exchangeCodeForToken,
  fetchDiscordUser,
  resolveAppRole,
} from "../services/discordAuth";
import { requireAuth } from "../middleware/auth";
import { signSession } from "../services/jwt";
import { consumeDesktopSession, createDesktopSession } from "../services/desktopAuthSessions";

const router = Router();

type OAuthClient = "web" | "desktop";

interface StatePayload {
  client: OAuthClient;
  /** Only set for client=desktop - the random id the Electron app generated so it
   * can poll for its token afterward (see desktopAuthSessions.ts for why polling
   * replaced a localhost redirect). */
  session?: string;
}

/** The OAuth `state` param round-trips through Discord unmodified, so it's used to
 * remember which client (web vs desktop) started the flow - signed so it can't be
 * tampered with, short-lived since it only needs to survive one login attempt. */
function signState(payload: StatePayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "10m" });
}

function verifyState(state: string): StatePayload {
  return jwt.verify(state, env.jwtSecret) as StatePayload;
}

/** Kicks off Discord login. ?client=desktop is used by the Electron app (which opens
 * this in the system browser); omit it (or client=web) for the website. Desktop also
 * sends ?session=<random id> it generated locally, used to hand the token back via
 * polling instead of a localhost redirect. */
router.get("/discord", (req, res) => {
  const client: OAuthClient = req.query.client === "desktop" ? "desktop" : "web";
  const session = typeof req.query.session === "string" ? req.query.session : undefined;
  const state = signState({ client, session });
  res.redirect(buildAuthorizeUrl(state));
});

router.get("/discord/callback", async (req, res) => {
  const { code, state } = req.query;
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing code or state");
  }

  let client: OAuthClient;
  let session: string | undefined;
  try {
    ({ client, session } = verifyState(state));
  } catch {
    return res.status(400).send("Invalid or expired login attempt - please try again");
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(accessToken);
    const role = await resolveAppRole(discordUser.id);

    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        discordUsername: discordUser.username,
        discordAvatarUrl: discordAvatarUrl(discordUser),
        role,
      },
      create: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatarUrl: discordAvatarUrl(discordUser),
        role,
      },
    });

    // Prisma generates its own Role enum type (structurally identical to shared's,
    // but TS enums are nominal - not the same type). Values line up 1:1 by design.
    const sessionToken = signSession({ userId: user.id, role: user.role as unknown as Role });

    if (client === "desktop") {
      // No redirect back to the desktop app - a localhost listener on the user's
      // machine is exactly the kind of thing Windows Firewall, antivirus, or a
      // stray port conflict can silently block. Instead the token is stashed
      // here under the session id the Electron app generated up front, and the
      // desktop app collects it by polling GET /auth/session/:id (pure outbound
      // HTTPS, nothing for a firewall to object to).
      if (session) createDesktopSession(session, sessionToken);
      res.set("Content-Type", "text/html");
      return res.send(
        "<html><body style=\"font-family:sans-serif;background:#0f1021;color:#e8e9fb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;\">" +
          "<p>Signed in - you can close this tab and return to Airline Ops.</p></body></html>"
      );
    }

    // Token-in-URL handoff, not a cookie - the API and website live on different
    // Render subdomains in production (onrender.com is on the public suffix list,
    // so they're genuinely different *sites*, not just different origins), and a
    // cross-site cookie is unreliable across browsers regardless of SameSite/Secure
    // (Safari ITP and Chrome's third-party cookie changes can both still block it).
    // The website's /auth/callback route reads the token from the URL and keeps it
    // in localStorage instead, sent as a Bearer header on every request.
    res.redirect(`${env.webOrigin}/auth/callback?token=${encodeURIComponent(sessionToken)}`);
  } catch (err) {
    console.error("Discord OAuth callback failed:", err);
    res.status(500).send("Login failed - check server logs");
  }
});

/** Polled by the desktop app after it opens the system browser for login. Returns
 * the session token once /discord/callback has stashed it, then deletes it -
 * one-time read, same as a redirect would only fire once. 404 means "not ready
 * yet or this id was never valid," which the desktop app treats as "keep polling"
 * up to its own timeout. */
router.get("/session/:id", (req, res) => {
  const token = consumeDesktopSession(req.params.id);
  if (!token) return res.status(404).json({ ready: false });
  res.json({ ready: true, token });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.post("/logout", (req, res) => {
  // Nothing to do server-side - the JWT is stateless and the client (web
  // localStorage or the desktop app's encrypted token file) discards its own
  // copy. This endpoint exists so the frontend has a consistent place to call.
  res.json({ ok: true });
});

export default router;
