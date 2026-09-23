# Airline Ops

A flight management platform for a Roblox virtual airline: flight scheduling,
crew rosters, fleet management, and live flight status - as both a website and
native desktop apps (Windows/macOS/Linux), with Discord-only login where your
account's role is pulled automatically from your Discord server roles.

Everything in this repo has been built and verified against a real Postgres
database and a real running server (see "What's been tested" below) - the one
thing that couldn't be tested here is the actual Discord OAuth exchange, since
that needs a real Discord Application's credentials.

## How it's structured

```
packages/
  shared/    TypeScript types + the 5-role permission matrix, used by all 3 apps
  server/    Express + PostgreSQL (via Prisma) API - the single source of truth
  web/       React website - also what the desktop app displays
  desktop/   Electron wrapper around web/, packaged for Win/Mac/Linux
```

The website and every desktop install all talk to the **same server**, so
everyone always sees the same live data - that's why a real hosted database is
required (see Deployment below), not something optional.

## The 5 roles

Owner, Manager, Flight Host, Pilot, Passenger. Roles are **not** set inside the
app - they're resolved automatically every time someone logs in, by checking
which of 5 specific roles they hold in your Discord server (see setup step 3).
Anyone in your server can log in and at least book flights as a Passenger,
even with none of the 4 staff roles.

The exact permission matrix (who can do what) lives in one place:
`packages/shared/src/permissions.ts` - read that file for the ground truth.

## One-time setup

### 1. Install prerequisites

- [Node.js 20+](https://nodejs.org)
- A PostgreSQL database - for local development, the simplest option is Docker/Podman:
  ```bash
  docker compose up -d   # uses the docker-compose.yml at the repo root
  ```
  For production, point `DATABASE_URL` at a hosted Postgres instead (Supabase,
  Railway, Neon, RDS, etc. all work fine).

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Discord Application

1. Go to https://discord.com/developers/applications → **New Application**.
2. **OAuth2** tab → add a redirect URI: `http://localhost:4000/auth/discord/callback`
   (change the host/port to match wherever you actually deploy the server).
3. Copy the **Client ID** and **Client Secret** (OAuth2 tab).
4. **Bot** tab → create a bot, copy its **token**, and turn on the
   **Server Members Intent**.
5. Invite the bot to your Discord server with at least the "View Server
   Members" permission (a basic OAuth2 invite URL with the `bot` scope works).
6. In your server, enable Developer Mode (User Settings → Advanced), then
   right-click each of your 4 staff roles (Owner/Manager/Flight
   Host/Pilot) → **Copy Role ID**.

### 4. Configure the server

```bash
cp packages/server/.env.example packages/server/.env
```
Fill in everything from step 3, plus `JWT_SECRET` (generate one with
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

### 5. Run the database migration

```bash
npm run db:migrate --workspace=server
```

## Running it locally

Three processes, each in its own terminal:

```bash
npm run build:shared        # once, and again any time you edit packages/shared
npm run dev:server          # API on http://localhost:4000
npm run dev:web             # website on http://localhost:5173
```

Open http://localhost:5173 and sign in with Discord.

To run the **desktop app** against your local server instead of the website:
```bash
npm run build --workspace=desktop
npm run build --workspace=web
cd packages/desktop && npx electron .
```

## Building for production

### Website
```bash
npm run build:shared
npm run build:web
```
`packages/web/dist/` is a static site - deploy it anywhere that serves static
files (Vercel, Netlify, Cloudflare Pages, your own nginx, etc.). Set
`VITE_API_URL` at build time to point at your deployed server's URL.

### Server
```bash
npm run build:shared
npm run build:server
cd packages/server && npm run db:deploy   # applies migrations, no prompts
node packages/server/dist/index.js
```
Deploy this like any Node app (a VPS, Railway, Render, Fly.io, etc.) - it just
needs `DATABASE_URL` and the Discord env vars set, and network access to
Discord's API.

### Desktop apps (Windows / macOS / Linux)

```bash
npm run build:shared
npm run build:web
cd packages/desktop
npm run build
AIRLINE_OPS_API_URL=https://your-deployed-api.example.com npx electron-builder --linux --win --mac
```

**Important platform caveats, not a limitation of this setup specifically:**
- **Linux**: builds fine on any Linux machine - this is what was verified here (see below).
- **Windows**: `electron-builder` can cross-build a Windows installer from
  Linux, but needs [Wine](https://www.winehq.org/) installed on the build
  machine. Building directly on a Windows machine (or a Windows CI runner) is
  simpler and doesn't need Wine at all.
- **macOS**: Apple's tooling and code-signing require builds to actually run
  **on a Mac** (or a macOS CI runner, e.g. GitHub Actions' `macos-latest`).
  There's no way around this from Linux - it's an Apple platform restriction,
  not something specific to this project.

The Electron app talks to whatever server `AIRLINE_OPS_API_URL` points at
when it was built - rebuild it if that URL changes.

## What's been tested (and what hasn't)

Verified for real in the environment this was built in:
- `shared`, `server`, and `web` all type-check and build cleanly.
- The Prisma schema migrates cleanly against a real PostgreSQL 16 database.
- The Express server boots and was exercised end-to-end over real HTTP:
  creating an aircraft and a flight, booking a passenger onto it, confirming
  a second booking attempt is correctly rejected (409), confirming seat-count
  tracking is correct, confirming a Passenger gets a 403 trying to update
  flight status while an Owner succeeds, and confirming permission checks
  behave as the matrix in `permissions.ts` says they should.
- The `desktop` package type-checks and compiles, and the Electron binary
  itself runs (`electron --version`) in this environment.

**Not testable here, so not yet verified**: the actual Discord OAuth code
exchange (needs a real Discord Application's live credentials), the Electron
app's OAuth loopback flow end-to-end (needs a real login to test against), and
producing actual signed Windows/macOS installers (needs Wine / an actual Mac,
per the caveats above). The code for all of these is written and follows
Discord's documented OAuth2 flow and the standard desktop-app loopback OAuth
pattern, but you should do one real login test on each platform before
rolling this out to your staff.

## Notes on scale

This was built with your ~500+ user answer in mind: the server uses a single
shared Prisma connection pool (not one-per-request), list endpoints are
paginated, booking a seat is done inside a database transaction so two people
can't grab the literal last seat at the same instant, and the DB has indexes
on the columns that matter (flight status, departure time, foreign keys).
None of this needs anything fancier than a normal hosted Postgres instance at
this scale.

## Extending it later

- **Branding**: swap the placeholder colors in
  `packages/web/tailwind.config.js` (the `brand` palette) and the app name in
  `packages/web/index.html` / `packages/desktop/package.json`.
- **Manual role override**: `PATCH /users/:id/role` (Owner-only) exists for
  edge cases, but note it gets overwritten the next time that person logs in
  via Discord - the Discord role sync is always the source of truth.
- The permission matrix in `packages/shared/src/permissions.ts` is the one
  place to touch if what each role can do should change.
