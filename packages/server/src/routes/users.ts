import { Router } from "express";
import { z } from "zod";
import { CREW_ELIGIBLE_ROLES, Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

// Everyone with a Membership in the current airline, with their Role there -
// this used to be a global user list, now scoped since Role only makes sense
// per-airline (the same Discord account can be Owner of one airline and a
// Passenger, or not a member at all, of another).
router.get("/", requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { airlineId: req.membership!.airlineId },
    include: { user: true },
    orderBy: { user: { discordUsername: "asc" } },
  });
  res.json(memberships.map((m) => ({ ...m.user, role: m.role, membershipId: m.id, roleLocked: m.roleLocked })));
});

// Everyone in the current airline whose Role can crew a flight (Owner/Manager/
// Flight Host/Pilot) - used to populate the crew-assignment picker without
// exposing the full member list to people below MANAGE_USER_ROLES.
router.get("/crew-eligible", requirePermission(Permission.MANAGE_CREW), async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { airlineId: req.membership!.airlineId, role: { in: CREW_ELIGIBLE_ROLES } },
    include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    orderBy: { user: { discordUsername: "asc" } },
  });
  res.json(memberships.map((m) => ({ ...m.user, role: m.role })));
});

const roleSchema = z.object({ role: z.nativeEnum(Role) });

// Permanent override, Owner-only, scoped to the current airline's Membership
// for that user. Roles normally resolve fresh from Discord server roles on
// every login (see services/membershipSync.ts) - setting one here marks it
// roleLocked, so that sync leaves it alone from now on instead of silently
// reverting it the next time that person logs back in via Discord. Use
// /:id/role/unlock to hand a membership back to Discord-driven sync.
router.patch("/:id/role", requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.membership.findUnique({
    where: { userId_airlineId: { userId: req.params.id, airlineId: req.membership!.airlineId } },
    include: { user: true },
  });
  if (!before) return res.status(404).json({ error: "User is not a member of this airline" });

  const membership = await prisma.membership.update({
    where: { id: before.id },
    data: { role: parsed.data.role, roleLocked: true },
    include: { user: true },
  });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "user.role_override",
    targetType: "User",
    targetId: membership.userId,
    detail: `${membership.user.discordUsername}: ${before.role} -> ${membership.role} (permanent)`,
  });
  res.json({ ...membership.user, role: membership.role, roleLocked: membership.roleLocked });
});

// Hands a membership back to Discord-driven sync - the opposite of the PATCH
// above. Doesn't change the role immediately; it'll re-resolve from that
// airline's RoleMapping + the person's current Discord roles next time sync
// runs for them (their next login, or the next "Sync Discord roles now").
router.post("/:id/role/unlock", requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const before = await prisma.membership.findUnique({
    where: { userId_airlineId: { userId: req.params.id, airlineId: req.membership!.airlineId } },
    include: { user: true },
  });
  if (!before) return res.status(404).json({ error: "User is not a member of this airline" });

  const membership = await prisma.membership.update({
    where: { id: before.id },
    data: { roleLocked: false },
    include: { user: true },
  });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "user.role_unlock",
    targetType: "User",
    targetId: membership.userId,
    detail: `${membership.user.discordUsername}: role unlocked, will resync from Discord`,
  });
  res.json({ ...membership.user, role: membership.role, roleLocked: membership.roleLocked });
});

export default router;
