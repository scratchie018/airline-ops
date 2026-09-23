import { Router } from "express";
import { z } from "zod";
import { AircraftStatus, Permission } from "shared";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  tailNumber: z.string().min(1).max(20),
  model: z.string().min(1).max(100),
  seatCapacity: z.number().int().positive().max(2000),
});

const updateSchema = createSchema.partial().extend({
  status: z.nativeEnum(AircraftStatus).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  const [items, total] = await Promise.all([
    prisma.aircraft.findMany({
      orderBy: { tailNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.aircraft.count(),
  ]);

  res.json({ items, total, page, pageSize });
});

router.post("/", requireAuth, requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const aircraft = await prisma.aircraft.create({ data: parsed.data });
  res.status(201).json(aircraft);
});

router.patch("/:id", requireAuth, requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const aircraft = await prisma.aircraft.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(aircraft);
  } catch {
    res.status(404).json({ error: "Aircraft not found" });
  }
});

// Soft-delete: retiring an aircraft instead of hard-deleting keeps flight history
// (which references it via a foreign key) intact.
router.delete("/:id", requireAuth, requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  try {
    const aircraft = await prisma.aircraft.update({
      where: { id: req.params.id },
      data: { status: AircraftStatus.RETIRED },
    });
    res.json(aircraft);
  } catch {
    res.status(404).json({ error: "Aircraft not found" });
  }
});

export default router;
