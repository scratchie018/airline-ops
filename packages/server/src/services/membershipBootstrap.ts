import { Role } from "shared";
import { prisma } from "../db";

/** Called right after Discord login. Every Role assignment used to be automatic
 * here (resolved from Discord server roles) - that's gone now, roles are 100%
 * set by hand from Admin > Roles. All this does is make sure a Discord account
 * that's genuinely a member of an airline's server has *some* Membership row
 * to work with (defaulting to Passenger, never anything higher) so staff have
 * someone to actually find and promote in Admin > Users - without this, a
 * brand-new person would have no way to ever appear there at all. Never
 * touches an existing Membership's role, and only ever creates new ones as
 * Passenger - zero role-guessing. */
export async function ensurePassengerMemberships(userId: string, userGuildIds: string[]): Promise<void> {
  if (userGuildIds.length === 0) return;

  const airlines = await prisma.airline.findMany({
    where: { discordGuildId: { in: userGuildIds } },
    select: { id: true },
  });
  if (airlines.length === 0) return;

  const existing = await prisma.membership.findMany({
    where: { userId, airlineId: { in: airlines.map((a) => a.id) } },
    select: { airlineId: true },
  });
  const existingAirlineIds = new Set(existing.map((m) => m.airlineId));

  const toCreate = airlines.filter((a) => !existingAirlineIds.has(a.id));
  if (toCreate.length === 0) return;

  await prisma.membership.createMany({
    data: toCreate.map((a) => ({ userId, airlineId: a.id, role: Role.PASSENGER })),
  });
}
