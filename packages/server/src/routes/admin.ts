import { Router } from "express";
import { z } from "zod";
import { Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

// Everything here is Owner-only (MANAGE_USER_ROLES is only granted to Owner in
// the permission matrix) - this is genuinely sensitive: it controls who gets
// staff access at all.
router.use(requireAuth, requireAirlineMembership, requirePermission(Permission.MANAGE_USER_ROLES));

const mappingSchema = z.object({
  discordRoleId: z.string().min(1).max(32),
  appRole: z.nativeEnum(Role),
  label: z.string().max(100).optional(),
});

router.get("/role-mappings", async (req, res) => {
  const mappings = await prisma.roleMapping.findMany({
    where: { airlineId: req.membership!.airlineId },
    orderBy: { createdAt: "asc" },
  });
  res.json(mappings);
});

router.post("/role-mappings", async (req, res) => {
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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
  } catch {
    res.status(409).json({ error: "That Discord role ID is already mapped" });
  }
});

router.patch("/role-mappings/:id", async (req, res) => {
  const parsed = mappingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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
});

router.delete("/role-mappings/:id", async (req, res) => {
  const mapping = await prisma.roleMapping.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!mapping) return res.status(404).json({ error: "Mapping not found" });

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

router.get("/audit-log", async (req, res) => {
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
