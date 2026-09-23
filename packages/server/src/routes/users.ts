import { Router } from "express";
import { z } from "zod";
import { CREW_ELIGIBLE_ROLES, Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

router.get("/", requireAuth, requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { discordUsername: "asc" } });
  res.json(users);
});

// Everyone whose account-wide Role can crew a flight (Owner/Manager/Flight Host/Pilot)
// - used to populate the crew-assignment picker without exposing the full user list
// to people below MANAGE_USER_ROLES.
router.get("/crew-eligible", requireAuth, requirePermission(Permission.MANAGE_CREW), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: CREW_ELIGIBLE_ROLES } },
    select: { id: true, discordUsername: true, discordAvatarUrl: true, role: true },
    orderBy: { discordUsername: "asc" },
  });
  res.json(users);
});

const roleSchema = z.object({ role: z.nativeEnum(Role) });

// Manual override, Owner-only. Roles normally resolve fresh from Discord server
// roles on every login (see services/discordAuth.ts) - this exists for edge cases
// (bot temporarily down, role mapping mid-change) and will be overwritten the next
// time that person logs back in via Discord.
router.patch("/:id/role", requireAuth, requirePermission(Permission.MANAGE_USER_ROLES), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: parsed.data.role } });
    recordAudit({
      actorId: req.user!.id,
      action: "user.role_override",
      targetType: "User",
      targetId: user.id,
      detail: `${user.discordUsername}: ${before?.role ?? "?"} -> ${user.role}`,
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

export default router;
