import { Role } from "shared";
import { prisma } from "../db";
import { resolveAppRoleForGuild } from "./discordAuth";

/** Called right after Discord login. Finds every Airline whose Discord guild this
 * user actually belongs to (from their OAuth `guilds` scope) and gives them a
 * Membership there, Role freshly resolved from that airline's RoleMapping table
 * plus their current Discord roles in that server - this is how a user "joins"
 * an airline as staff or as a passenger without typing anything in; showing up
 * in the right Discord server (with, optionally, the right role) is enough.
 *
 * Deliberately does NOT touch an existing OWNER membership - an airline's
 * creator gets OWNER directly at creation time, before any RoleMapping likely
 * exists to map their own Discord role back to OWNER, so re-deriving on every
 * login would otherwise silently demote them to PASSENGER the moment they log
 * back in. Every other existing membership is re-derived each login (promotions
 * and demotions elsewhere in the org do reflect current Discord roles), and any
 * airline the user has no Membership in yet gets one created fresh. */
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
    if (current?.role === Role.OWNER) continue;

    const role = await resolveAppRoleForGuild(discordUserId, airline.discordGuildId, airline.id);
    await prisma.membership.upsert({
      where: { userId_airlineId: { userId, airlineId: airline.id } },
      update: { role },
      create: { userId, airlineId: airline.id, role },
    });
  }
}
