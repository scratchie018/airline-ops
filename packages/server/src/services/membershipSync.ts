import { prisma } from "../db";
import { discordAvatarUrl, fetchGuildMembers, resolveAppRoleForGuild, resolveRoleFromRoleIds } from "./discordAuth";

/** Called right after Discord login. Finds every Airline whose Discord guild this
 * user actually belongs to (from their OAuth `guilds` scope) and gives them a
 * Membership there, Role freshly resolved from that airline's RoleMapping table
 * plus their current Discord roles in that server - this is how a user "joins"
 * an airline as staff or as a passenger without typing anything in; showing up
 * in the right Discord server (with, optionally, the right role) is enough.
 *
 * Deliberately does NOT touch a roleLocked membership - set automatically on
 * the Owner membership created alongside a new Airline (before any RoleMapping
 * likely exists to map their own Discord role back to OWNER, so re-deriving on
 * every login would otherwise silently demote them to PASSENGER the moment
 * they log back in), and settable by an Owner on anyone else via Admin > Users
 * for a genuinely permanent override. Every other existing membership is
 * re-derived each login (promotions and demotions elsewhere in the org do
 * reflect current Discord roles), and any airline the user has no Membership
 * in yet gets one created fresh. */
export async function syncMembershipsFromDiscordGuilds(
  userId: string,
  discordUserId: string,
  userGuildIds: string[]
): Promise<void> {
  if (userGuildIds.length === 0) return;

  const airlines = await prisma.airline.findMany({
    where: { discordGuildId: { in: userGuildIds } },
    select: { id: true, discordGuildId: true },
  });
  if (airlines.length === 0) return;

  const existing = await prisma.membership.findMany({
    where: { userId, airlineId: { in: airlines.map((a) => a.id) } },
  });
  const existingByAirline = new Map(existing.map((m) => [m.airlineId, m]));

  for (const airline of airlines) {
    const current = existingByAirline.get(airline.id);
    if (current?.roleLocked) continue;

    const role = await resolveAppRoleForGuild(discordUserId, airline.discordGuildId, airline.id);
    await prisma.membership.upsert({
      where: { userId_airlineId: { userId, airlineId: airline.id } },
      update: { role },
      create: { userId, airlineId: airline.id, role },
    });
  }
}

export interface GuildSyncResult {
  membersScanned: number;
  usersCreated: number;
  membershipsCreated: number;
  membershipsUpdated: number;
}

/** The "double check, even for people already in the server" reconciliation -
 * walks the airline's ENTIRE Discord member list (not just whoever happens to
 * log in) and gives everyone a User + Membership with a freshly resolved Role.
 * Unlike the login-time sync, this can create a User for someone who has never
 * signed into the app themselves - the bot already has their Discord identity
 * (id/username/avatar) from the member list, so there's no need to wait for
 * them to click "Sign in with Discord" before they show up in the roster.
 *
 * Same roleLocked protection as syncMembershipsFromDiscordGuilds, for the same
 * reasons: this can run before any RoleMapping exists to reconfirm the airline
 * creator's own Discord role as OWNER, and an Owner may have deliberately
 * pinned someone else's role permanently via Admin > Users. */
export async function syncAllMembersForAirline(airlineId: string): Promise<GuildSyncResult> {
  const airline = await prisma.airline.findUniqueOrThrow({ where: { id: airlineId } });
  const [members, mappings, existingMemberships] = await Promise.all([
    fetchGuildMembers(airline.discordGuildId),
    prisma.roleMapping.findMany({ where: { airlineId } }),
    prisma.membership.findMany({ where: { airlineId } }),
  ]);

  const existingByUserId = new Map(existingMemberships.map((m) => [m.userId, m]));
  const result: GuildSyncResult = { membersScanned: members.length, usersCreated: 0, membershipsCreated: 0, membershipsUpdated: 0 };

  for (const member of members) {
    const existingUser = await prisma.user.findUnique({ where: { discordId: member.user.id } });
    const user = await prisma.user.upsert({
      where: { discordId: member.user.id },
      update: { discordUsername: member.user.username, discordAvatarUrl: discordAvatarUrl(member.user) },
      create: {
        discordId: member.user.id,
        discordUsername: member.user.username,
        discordAvatarUrl: discordAvatarUrl(member.user),
      },
    });
    if (!existingUser) result.usersCreated++;

    const current = existingByUserId.get(user.id);
    if (current?.roleLocked) continue;

    const role = resolveRoleFromRoleIds(member.roles, mappings);
    if (current) {
      if (current.role !== role) {
        await prisma.membership.update({ where: { id: current.id }, data: { role } });
        result.membershipsUpdated++;
      }
    } else {
      await prisma.membership.create({ data: { userId: user.id, airlineId, role } });
      result.membershipsCreated++;
    }
  }

  return result;
}
