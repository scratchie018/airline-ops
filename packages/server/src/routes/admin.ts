import { Request, Router } from "express";
import { z } from "zod";
import { Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";
import { MissingServerMembersIntentError } from "../services/discordAuth";
import { syncAllMembersForAirline } from "../services/membershipSync";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

const mappingSchema = z.object({
  discordRoleId: z.string().min(1).max(32),
  appRole: z.nativeEnum(Role),
  label: z.string().max(100).optional(),
});

// Role-mapping management ("add custom roles") is Owner AND Manager - split
// out from MANAGE_USER_ROLES (which stays Owner-only below, for the more
// sensitive per-user override + audit log) so an Owner can delegate day-to-day
// Discord role configuration without also handing out that.
router.get("/role-mappings", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const mappings = await prisma.roleMapping.findMany({
    where: { airlineId: req.membership!.airlineId },
    orderBy: { createdAt: "asc" },
  });
  res.json(mappings);
});

// A Manager creating/editing a mapping that grants OWNER would let them mint
// themselves (or anyone) an Owner via Discord roles they may not even control -
// only the Owner can point a mapping at OWNER.
function forbidOwnerMappingByManager(req: Request, appRole?: Role): string | null {
  if (appRole === Role.OWNER && req.membership!.role !== Role.OWNER) {
    return "Only the Owner can create a role mapping that grants Owner";
  }
  return null;
}

router.post("/role-mappings", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const forbidden = forbidOwnerMappingByManager(req, parsed.data.appRole);
  if (forbidden) return res.status(403).json({ error: forbidden });

  try {
    const mapping = await prisma.roleMapping.create({
      data: { ...parsed.data, airlineId: req.membership!.airlineId },
    });
    recordAudit({
      airlineId: req.membership!.airlineId,
      actorId: req.user!.id,
      action: "role_mapping.create",
      targetType: "RoleMapping",
      targetId: mapping.id,
      detail: `${parsed.data.discordRoleId} -> ${parsed.data.appRole}`,
    });
    res.status(201).json(mapping);
    // Apply the new mapping across everyone already in the server immediately,
    // rather than waiting for each of them to log in again - fire-and-forget,
    // the response above shouldn't wait on a full guild scan.
    syncAllMembersForAirline(req.membership!.airlineId).catch((err) =>
      console.error("Post-mapping-create role sync failed:", err)
    );
  } catch {
    res.status(409).json({ error: "That Discord role ID is already mapped" });
  }
});

router.patch("/role-mappings/:id", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const parsed = mappingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const forbidden = forbidOwnerMappingByManager(req, parsed.data.appRole);
  if (forbidden) return res.status(403).json({ error: forbidden });

  // updateMany + a re-fetch (rather than update({where:{id}})) so the
  // airlineId filter is actually enforced - a bare id lookup would happily
  // let an Owner of airline A edit a RoleMapping row belonging to airline B
  // if they guessed/reused its id.
  const { count } = await prisma.roleMapping.updateMany({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: "Mapping not found" });

  const mapping = await prisma.roleMapping.findUnique({ where: { id: req.params.id } });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "role_mapping.update",
    targetType: "RoleMapping",
    targetId: mapping!.id,
    detail: `${mapping!.discordRoleId} -> ${mapping!.appRole}`,
  });
  res.json(mapping);
  syncAllMembersForAirline(req.membership!.airlineId).catch((err) =>
    console.error("Post-mapping-update role sync failed:", err)
  );
});

router.delete("/role-mappings/:id", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const mapping = await prisma.roleMapping.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!mapping) return res.status(404).json({ error: "Mapping not found" });
  if (mapping.appRole === Role.OWNER && req.membership!.role !== Role.OWNER) {
    return res.status(403).json({ error: "Only the Owner can remove a role mapping that grants Owner" });
  }

  await prisma.roleMapping.delete({ where: { id: mapping.id } });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "role_mapping.delete",
    targetType: "RoleMapping",
    targetId: mapping.id,
    detail: `${mapping.discordRoleId} -> ${mapping.appRole}`,
  });
  res.status(204).send();
});

// The "double check, even for people already in the server" button - walks the
// airline's whole Discord member list and gives everyone a fresh User +
// Membership, not just whoever happens to log in. Same MANAGE_ROLE_MAPPINGS
// gate (Owner + Manager) since it's really the same capability: keeping
// app roles in sync with the Discord server's actual role assignments.
router.post("/sync-roles", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  try {
    const result = await syncAllMembersForAirline(req.membership!.airlineId);
    recordAudit({
      airlineId: req.membership!.airlineId,
      actorId: req.user!.id,
      action: "roles.sync",
      targetType: "Airline",
      targetId: req.membership!.airlineId,
      detail: `scanned ${result.membersScanned}, +${result.usersCreated} users, +${result.membershipsCreated}/${result.membershipsUpdated} memberships`,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof MissingServerMembersIntentError) {
      return res.status(422).json({
        error:
          "Discord blocked the member list: enable \"Server Members Intent\" for the bot in the Discord " +
          "Developer Portal (Bot tab -> Privileged Gateway Intents), then try again.",
      });
    }
    console.error("Manual role sync failed:", err);
    res.status(502).json({ error: "Couldn't reach Discord to sync roles - try again shortly" });
  }
});

router.get("/audit-log", requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
  const where = { airlineId: req.membership!.airlineId };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

export default router;
