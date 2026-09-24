import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { env } from "../env";
import { buildAuthorizeUrl, discordAvatarUrl, exchangeCodeForToken, fetchDiscordUser, fetchUserGuildIds } from "../services/discordAuth";
import { ensurePassengerMemberships } from "../services/membershipBootstrap";
import { requireAuth } from "../middleware/auth";
import { signSession } from "../services/jwt";

const router = Router();

/** The OAuth `state` param round-trips through Discord unmodified - signed so
 * it can't be tampered with (plain CSRF protection), short-lived since it
 * only needs to survive one login attempt. No payload beyond that: the
 * desktop app used to need this to carry a client type + polling session id,
 * but it's just a Chromium shell around the real website now (see
 * packages/desktop/src/main.ts) and goes through the exact same flow as a
 * browser tab. */
function signState(): string {
  return jwt.sign({}, env.jwtSecret, { expiresIn: "10m" });
}

function verifyState(state: string): void {
  jwt.verify(state, env.jwtSecret);
}

router.get("/discord", (_req, res) => {
  res.redirect(buildAuthorizeUrl(signState()));
});

router.get("/discord/callback", async (req, res) => {
  const { code, state } = req.query;
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing code or state");
  }

  try {
    verifyState(state);
  } catch {
    return res.status(400).send("Invalid or expired login attempt - please try again");
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(accessToken);

    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        discordUsername: discordUser.username,
        discordAvatarUrl: discordAvatarUrl(discordUser),
      },
      create: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatarUrl: discordAvatarUrl(discordUser),
      },
    });

    // No automatic role assignment here anymore - see membershipBootstrap.ts.
    // This only makes sure a genuine member of an airline's Discord server has
    // a Membership row to work with (as Passenger) so staff can find and
    // promote them in Admin > Users.
    try {
      const guildIds = await fetchUserGuildIds(accessToken);
      await ensurePassengerMemberships(user.id, guildIds);
    } catch (bootstrapErr) {
      // Shouldn't block login entirely over a transient Discord API hiccup -
      // worst case they don't show up in the roster until their next login.
      console.error("Membership bootstrap failed:", bootstrapErr);
    }

    const sessionToken = signSession({ userId: user.id });

    // Token-in-URL handoff, not a cookie - the API and website live on different
    // Render subdomains in production (onrender.com is on the public suffix list,
    // so they're genuinely different *sites*, not just different origins), and a
    // cross-site cookie is unreliable across browsers regardless of SameSite/Secure
    // (Safari ITP and Chrome's third-party cookie changes can both still block it).
    // The website's /auth/callback route reads the token from the URL and keeps it
    // in localStorage instead, sent as a Bearer header on every request. The
    // desktop app goes through this exact same redirect now too, since it's just
    // this website loaded in an Electron window.
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
  // localStorage, same for desktop now) discards its own copy. This endpoint
  // exists so the frontend has a consistent place to call.
  res.json({ ok: true });
});

export default router;
