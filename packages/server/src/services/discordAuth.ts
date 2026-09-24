import { env } from "../env";

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

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface DiscordGuildMember {
  roles: string[];
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
}

// Discord permission bitflags relevant here (out of the full set) - see
// https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
const PERMISSION_ADMINISTRATOR = 1n << 3n;
const PERMISSION_MANAGE_ROLES = 1n << 28n;

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: env.discordRedirectUri,
    response_type: "code",
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

function guildIconUrl(guild: DiscordGuild): string | null {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=256`;
}

/** Confirms the shared bot has actually been invited into this guild and grabs
 * its name/icon straight from Discord - checked (and used to fill in the
 * Airline record) when someone registers a new Airline, or edits an existing
 * one's guild ID, so nobody has to type a server name in by hand and a typo'd
 * guild ID (or one the bot was never added to) fails fast with a clear
 * message. Returns null if the bot isn't in that guild. */
export async function fetchGuildInfo(guildId: string): Promise<{ name: string; iconUrl: string | null } | null> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  if (!res.ok) return null;
  const guild = (await res.json()) as DiscordGuild;
  return { name: guild.name, iconUrl: guildIconUrl(guild) };
}

/** The Discord guild IDs this user is actually a member of, straight from their
 * own OAuth token (the `guilds` scope) - used right after login purely to know
 * which of the platform's airlines this account is a member of (so it can get
 * a baseline Passenger Membership there - see membershipBootstrap.ts), not to
 * decide what Role they should have. */
export async function fetchUserGuildIds(accessToken: string): Promise<string[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user's guilds: ${res.status} ${await res.text()}`);
  }
  const guilds = (await res.json()) as { id: string }[];
  return guilds.map((g) => g.id);
}

/** Every role in a guild, as configured in Discord - used by the Admin > Roles
 * panel so an Owner/Manager picks from the server's actual roles instead of
 * typing a Discord role ID in by hand. Excludes the @everyone role (id equals
 * the guild id) and Discord-managed roles (bot/integration roles, which can't
 * be meaningfully assigned to a person by hand anyway). */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch guild roles: ${res.status} ${await res.text()}`);
  }
  const roles = (await res.json()) as DiscordRole[];
  return roles.filter((r) => r.id !== guildId && !r.managed).sort((a, b) => b.position - a.position);
}

/** Whether the bot can manage roles in this guild (has the MANAGE_ROLES or
 * ADMINISTRATOR permission via any role it holds, including @everyone) - the
 * gate for the "+ New role" button, which has the bot create a real Discord
 * role. Computed from the bot's own guild-member roles rather than assumed,
 * since it can change any time an Owner edits the bot's role in Discord. */
export async function botCanManageRoles(guildId: string): Promise<boolean> {
  const [memberRes, roles] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${guildId}/members/${env.discordClientId}`, {
      headers: { Authorization: `Bot ${env.discordBotToken}` },
    }),
    fetch(`${DISCORD_API}/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${env.discordBotToken}` } }).then(
      (r) => (r.ok ? (r.json() as Promise<DiscordRole[]>) : [])
    ),
  ]);
  if (!memberRes.ok) return false;
  const member = (await memberRes.json()) as DiscordGuildMember;

  const roleIds = new Set([...member.roles, guildId]); // guildId doubles as the @everyone role's id
  let permissions = 0n;
  for (const role of roles) {
    if (roleIds.has(role.id)) permissions |= BigInt(role.permissions);
  }
  return (permissions & PERMISSION_ADMINISTRATOR) !== 0n || (permissions & PERMISSION_MANAGE_ROLES) !== 0n;
}

/** Has the bot create a brand-new Discord role in this guild, so an Owner
 * doesn't have to go create it in Discord first before mapping it to an app
 * class. Throws with Discord's own error text on failure (e.g. hierarchy or
 * permission issues) - the caller is expected to have already checked
 * botCanManageRoles for the common case, this is the actual attempt. */
export async function createGuildRole(guildId: string, name: string): Promise<DiscordRole> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
    method: "POST",
    headers: { Authorization: `Bot ${env.discordBotToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Discord role: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as DiscordRole;
}
