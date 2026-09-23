import { Router } from "express";
import { z } from "zod";
import { AircraftStatus, Permission } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

const createSchema = z.object({
  tailNumber: z.string().min(1).max(20),
  model: z.string().min(1).max(100),
  seatCapacity: z.number().int().positive().max(2000),
});

const updateSchema = createSchema.partial().extend({
  status: z.nativeEnum(AircraftStatus).optional(),
});

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const where = { airlineId: req.membership!.airlineId };

  const [items, total] = await Promise.all([
    prisma.aircraft.findMany({
      where,
      orderBy: { tailNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.aircraft.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

router.post("/", requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const aircraft = await prisma.aircraft.create({
      data: { ...parsed.data, airlineId: req.membership!.airlineId },
    });
    res.status(201).json(aircraft);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "That tail number is already in use" });
    throw err;
  }
});

router.patch("/:id", requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { count } = await prisma.aircraft.updateMany({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: "Aircraft not found" });

  const aircraft = await prisma.aircraft.findUnique({ where: { id: req.params.id } });
  res.json(aircraft);
});

// Soft-delete: retiring an aircraft instead of hard-deleting keeps flight history
// (which references it via a foreign key) intact.
router.delete("/:id", requirePermission(Permission.MANAGE_AIRCRAFT), async (req, res) => {
  const { count } = await prisma.aircraft.updateMany({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
    data: { status: AircraftStatus.RETIRED },
  });
  if (count === 0) return res.status(404).json({ error: "Aircraft not found" });

  const aircraft = await prisma.aircraft.findUnique({ where: { id: req.params.id } });
  res.json(aircraft);
});

export default router;
