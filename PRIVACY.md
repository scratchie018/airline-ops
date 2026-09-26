# Privacy & verification

What Airline Ops collects through Discord login, what it doesn't, and how to
check any of this yourself instead of taking it on faith. The live version of
this same page is at `/privacy` on the running site, linked from the login
screen and the footer of every page.

## What signing in with Discord gives us

Just your Discord user ID, username, and avatar (the OAuth `identify` scope)
- stored so the app knows who you are on your next visit.

We also ask for your list of Discord servers (the `guilds` scope), but only to
check, once at login, whether you're already in an airline's Discord server -
if so you're added as a Passenger there automatically. That list itself isn't
stored anywhere; see `ensurePassengerMemberships` in
`packages/server/src/services/membershipBootstrap.ts`.

Your Discord access token is used for those two lookups during login and then
discarded - it's never saved to a database and never used again after that.
See `packages/server/src/routes/auth.ts`.

We never see your email, your DMs, or the content of any channel. This app
can't message anyone as you or read anything you haven't explicitly shown it.

## How your role is decided

Each airline's own Discord bot reads your roles in *their* server using the
bot's own permissions (`packages/server/src/services/discordAuth.ts`), not
your personal login token - that's how "Pilot," "Manager," etc. stay in sync
with Discord roles without this app ever touching your account directly.

## Staying signed in

After login you get a signed JWT kept in your browser and sent as a Bearer
token with each request. There's no separate server-side session store to be
breached independently of that token; see `packages/server/src/services/jwt.ts`.

## Anyone else involved?

Discord, for the login itself. And, only if an airline's Owner has configured
one, a Discord webhook URL *they* set up, used solely to post that airline's
own flight announcements to a channel they chose - not something this app
reaches out to on its own for any other reason.

## Verifying this yourself

The full source is public at this repo. Every deployed build stamps the exact
git commit it was compiled from:

- The web build injects it at build time (`packages/web/vite.config.ts`,
  `__COMMIT_SHA__`) from Render's own `RENDER_GIT_COMMIT` env var, falling
  back to `git rev-parse HEAD` for local builds.
- The API exposes it at `GET /health` (`packages/server/src/index.ts`).
- Both are shown, linked to their exact commit on GitHub, in the footer of
  every page (`packages/web/src/components/BuildInfo.tsx`).

Open that commit and you're looking at literally the code running in
production - not just "code that exists somewhere in the repo's history."
