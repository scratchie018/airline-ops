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

const router = Router();

type OAuthClient = "web" | "desktop";

/** The OAuth `state` param round-trips through Discord unmodified, so it's used to
 * remember which client (web vs desktop) started the flow - signed so it can't be
 * tampered with, short-lived since it only needs to survive one login attempt. */
function signState(client: OAuthClient): string {
  return jwt.sign({ client }, env.jwtSecret, { expiresIn: "10m" });
}

function verifyState(state: string): OAuthClient {
  const payload = jwt.verify(state, env.jwtSecret) as { client: OAuthClient };
  return payload.client;
}

/** Kicks off Discord login. ?client=desktop is used by the Electron app (which opens
 * this in the system browser); omit it (or client=web) for the website. */
router.get("/discord", (req, res) => {
  const client: OAuthClient = req.query.client === "desktop" ? "desktop" : "web";
  const state = signState(client);
  res.redirect(buildAuthorizeUrl(state));
});

router.get("/discord/callback", async (req, res) => {
  const { code, state } = req.query;
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing code or state");
  }

  let client: OAuthClient;
  try {
    client = verifyState(state);
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
      // Electron's main process is running a short-lived loopback server on this
      // origin purely to catch this one redirect and grab the token out of it.
      return res.redirect(`${env.desktopRedirectOrigin}/callback?token=${encodeURIComponent(sessionToken)}`);
    }

    // Same token-in-URL handoff as the desktop flow, not a cookie - the API and
    // website live on different Render subdomains in production (onrender.com is
    // on the public suffix list, so they're genuinely different *sites*, not just
    // different origins), and a cross-site cookie is unreliable across browsers
    // regardless of SameSite/Secure (Safari ITP and Chrome's third-party cookie
    // changes both can still block it). The website's /auth/callback route reads
    // the token from the URL and keeps it in localStorage instead, sent as a
    // Bearer header on every request - the exact mechanism already proven working
    // for the desktop app, just without Electron's local loopback server in the
    // middle.
    res.redirect(`${env.webOrigin}/auth/callback?token=${encodeURIComponent(sessionToken)}`);
  } catch (err) {
    console.error("Discord OAuth callback failed:", err);
    res.status(500).send("Login failed - check server logs");
  }
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
