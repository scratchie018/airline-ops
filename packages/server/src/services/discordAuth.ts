import { Role } from "shared";
import { env } from "../env";
import { prisma } from "../db";

const ROLE_PRECEDENCE: Role[] = [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT];

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

interface DiscordGuildMember {
  roles: string[];
}

interface DiscordPartialGuild {
  id: string;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: env.discordRedirectUri,
    response_type: "code",
    // identify: who they are. guilds: which Discord servers they're in - used
    // right after login to auto-discover which airlines (each backed by one
    // Discord server) this account should get a Membership in, without the
    // user having to manually type in a guild ID anywhere. Neither scope hands
    // us anything sensitive beyond "member of these public-ish server IDs."
    scope: "identify guilds",
    state,
    // No prompt=none here on purpose - that tells Discord to skip the consent
    // UI entirely and silently succeed-or-fail, which is for background
    // re-auth checks, not an actual "Sign in with Discord" button. It was
    // causing the button to visibly flash the consent screen and auto-continue
    // without a real click.
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as DiscordTokenResponse;
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Discord user: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as DiscordUser;
}

/** This used to return null for anyone without a custom avatar set, which meant
 * they showed up with no pfp at all in the UI - Discord always has SOME avatar to
 * show (the default one), it just isn't in the /users/@me response directly. New
 * username-system accounts (discriminator "0") get their default avatar from
 * (id >> 22) % 6; legacy #NNNN accounts still use discriminator % 5. */
export function discordAvatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  const defaultIndex =
    user.discriminator && user.discriminator !== "0"
      ? Number(user.discriminator) % 5
      : Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

/** Whether the shared bot has actually been invited into this guild - checked
 * when someone tries to register a new Airline against it, so a guild ID typo
 * (or a server the bot was never added to) fails fast with a clear message
 * instead of silently creating an airline whose role sync can never work. */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  return res.ok;
}

/** The Discord guild IDs this user is actually a member of, straight from their
 * own OAuth token (the `guilds` scope) - used right after login to work out
 * which of the platform's airlines they should get a Membership in, without
 * checking every airline's guild via the bot for every login. */
export async function fetchUserGuildIds(accessToken: string): Promise<string[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user's guilds: ${res.status} ${await res.text()}`);
  }
  const guilds = (await res.json()) as DiscordPartialGuild[];
  return guilds.map((g) => g.id);
}

/** Looks up the user's roles in one airline's guild using the bot token (not the
 * user's own OAuth token - Discord doesn't reliably expose a normal user's guild
 * roles via the identify/guilds scopes, but a bot that's a member of the server
 * can always read this for any member) and maps them to one of the 5 app Roles
 * using that airline's own RoleMapping table. Highest-privilege match wins when
 * a user holds more than one mapped Discord role; PASSENGER is the default for
 * anyone who holds none of the 4 staff roles - they can still log in and book
 * flights, just without any staff permissions. */
export async function resolveAppRoleForGuild(
  discordUserId: string,
  guildId: string,
  airlineId: string
): Promise<Role> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });

  if (res.status === 404) {
    // Authenticated with Discord but not (or no longer) a member of this
    // airline's server.
    return Role.PASSENGER;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch guild member: ${res.status} ${await res.text()}`);
  }

  const member = (await res.json()) as DiscordGuildMember;
  const roleIds = new Set(member.roles);

  const mappings = await prisma.roleMapping.findMany({ where: { airlineId } });
  const byRole = new Map(mappings.map((m) => [m.discordRoleId, m.appRole as Role]));
  for (const appRole of ROLE_PRECEDENCE) {
    const match = mappings.find((m) => m.appRole === appRole && roleIds.has(m.discordRoleId));
    if (match) return byRole.get(match.discordRoleId)!;
  }
  return Role.PASSENGER;
}
