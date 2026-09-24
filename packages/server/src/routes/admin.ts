import { Request, Router } from "express";
import { z } from "zod";
import { Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";
import { botCanManageRoles, createGuildRole, fetchGuildRoles } from "../services/discordAuth";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

// A Manager creating/editing a mapping that grants OWNER would let them mint
// themselves (or anyone) an Owner via Discord roles they may not even control -
// only the Owner can point a mapping at OWNER.
function forbidOwnerMappingByManager(req: Request, appRole?: Role): string | null {
  if (appRole === Role.OWNER && req.membership!.role !== Role.OWNER) {
    return "Only the Owner can set a role to Owner";
  }
  return null;
}

/** The Admin > Roles panel's main data: every real role in the airline's
 * Discord server, each paired with its current class mapping (if any), plus
 * whether the bot can create new roles here right now - entirely live from
 * Discord, not the leftover state of some past sync. Nothing here writes
 * anything automatically; it's just what the panel needs to render.
 *
 * Role-mapping management ("set each Discord role as one of the classes") is
 * Owner AND Manager - split out from MANAGE_USER_ROLES (which stays
 * Owner-only below, for the more sensitive per-user override + audit log) so
 * an Owner can delegate day-to-day Discord role configuration without also
 * handing out that. */
router.get("/discord-roles", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const airline = await prisma.airline.findUniqueOrThrow({ where: { id: req.membership!.airlineId } });

  try {
    const [roles, canManage, mappings] = await Promise.all([
      fetchGuildRoles(airline.discordGuildId),
      botCanManageRoles(airline.discordGuildId),
      prisma.roleMapping.findMany({ where: { airlineId: airline.id } }),
    ]);
    const mappingByRoleId = new Map(mappings.map((m) => [m.discordRoleId, m]));

    res.json({
      botCanManageRoles: canManage,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        mapping: mappingByRoleId.get(r.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch Discord roles:", err);
    res.status(502).json({ error: "Couldn't reach Discord to load this server's roles - try again shortly" });
  }
});

const setMappingSchema = z.object({
  discordRoleId: z.string().min(1).max(32),
  discordRoleName: z.string().min(1).max(100),
  appRole: z.nativeEnum(Role),
});

/** Sets (creating or updating) which class an existing Discord role maps to -
 * the "ability to set each role as one of the classes" from the panel, one
 * role at a time. */
router.put("/discord-roles/mapping", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const parsed = setMappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const forbidden = forbidOwnerMappingByManager(req, parsed.data.appRole);
  if (forbidden) return res.status(403).json({ error: forbidden });

  const mapping = await prisma.roleMapping.upsert({
    where: { airlineId_discordRoleId: { airlineId: req.membership!.airlineId, discordRoleId: parsed.data.discordRoleId } },
    update: { appRole: parsed.data.appRole, label: parsed.data.discordRoleName },
    create: {
      airlineId: req.membership!.airlineId,
      discordRoleId: parsed.data.discordRoleId,
      appRole: parsed.data.appRole,
      label: parsed.data.discordRoleName,
    },
  });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "role_mapping.set",
    targetType: "RoleMapping",
    targetId: mapping.id,
    detail: `${parsed.data.discordRoleName} -> ${parsed.data.appRole}`,
  });
  res.json(mapping);
});

/** Clears a role's class mapping (it stays a normal Discord role, just no
 * longer tied to an app class here). */
router.delete("/discord-roles/mapping/:discordRoleId", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const mapping = await prisma.roleMapping.findFirst({
    where: { airlineId: req.membership!.airlineId, discordRoleId: req.params.discordRoleId },
  });
  if (!mapping) return res.status(404).json({ error: "That role isn't mapped to a class" });
  if (mapping.appRole === Role.OWNER && req.membership!.role !== Role.OWNER) {
    return res.status(403).json({ error: "Only the Owner can unmap a role that grants Owner" });
  }

  await prisma.roleMapping.delete({ where: { id: mapping.id } });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "role_mapping.delete",
    targetType: "RoleMapping",
    targetId: mapping.id,
    detail: `${mapping.label ?? mapping.discordRoleId} -> ${mapping.appRole}`,
  });
  res.status(204).send();
});

const newRoleSchema = z.object({
  name: z.string().min(1).max(100),
  appRole: z.nativeEnum(Role),
});

/** The "+ New role" button: has the bot create a brand-new Discord role in
 * the airline's server (so nobody has to go make it in Discord first) and
 * immediately maps it to a class. Requires the bot to actually have
 * Manage Roles in that server - checked again here even though the frontend
 * already grays the button out for this, since that state can go stale. */
router.post("/discord-roles", requirePermission(Permission.MANAGE_ROLE_MAPPINGS), async (req, res) => {
  const parsed = newRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const forbidden = forbidOwnerMappingByManager(req, parsed.data.appRole);
  if (forbidden) return res.status(403).json({ error: forbidden });

  const airline = await prisma.airline.findUniqueOrThrow({ where: { id: req.membership!.airlineId } });

  const canManage = await botCanManageRoles(airline.discordGuildId);
  if (!canManage) {
    return res.status(403).json({
      error: "The bot needs the Manage Roles permission in your Discord server to create roles - check its role there.",
    });
  }

  try {
    const role = await createGuildRole(airline.discordGuildId, parsed.data.name);
    const mapping = await prisma.roleMapping.create({
      data: {
        airlineId: airline.id,
        discordRoleId: role.id,
        appRole: parsed.data.appRole,
        label: role.name,
      },
    });
    recordAudit({
      airlineId: airline.id,
      actorId: req.user!.id,
      action: "role_mapping.create_discord_role",
      targetType: "RoleMapping",
      targetId: mapping.id,
      detail: `created "${role.name}" -> ${parsed.data.appRole}`,
    });
    res.status(201).json({ id: role.id, name: role.name, color: role.color, mapping });
  } catch (err) {
    console.error("Discord role creation failed:", err);
    res.status(502).json({ error: "Discord rejected the role creation - try again shortly" });
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
