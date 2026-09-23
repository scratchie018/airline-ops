import { Router } from "express";
import { z } from "zod";
import { CrewPosition, FlightStatus, Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

const createSchema = z.object({
  flightNumber: z.string().min(1).max(20),
  aircraftId: z.string().uuid(),
  origin: z.string().min(1).max(10),
  destination: z.string().min(1).max(10),
  departureTime: z.string().datetime(),
  arrivalTime: z.string().datetime(),
});

const updateSchema = createSchema.partial();

const statusSchema = z.object({ status: z.nativeEnum(FlightStatus) });

router.get("/", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const status = req.query.status as FlightStatus | undefined;

  const where = status ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.flight.findMany({
      where,
      orderBy: { departureTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { aircraft: true },
    }),
    prisma.flight.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

router.get("/:id", requireAuth, async (req, res) => {
  const flight = await prisma.flight.findUnique({
    where: { id: req.params.id },
    include: {
      aircraft: true,
      crew: { include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } } },
      bookings: { include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } } },
    },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const activeBookings = flight.bookings.filter((b) => b.status !== "CANCELLED").length;
  res.json({ ...flight, seatsAvailable: flight.aircraft.seatCapacity - activeBookings });
});

router.post("/", requireAuth, requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const flight = await prisma.flight.create({
    data: { ...parsed.data, createdById: req.user!.id },
  });
  recordAudit({
    actorId: req.user!.id,
    action: "flight.create",
    targetType: "Flight",
    targetId: flight.id,
    detail: `${flight.flightNumber} ${flight.origin}->${flight.destination}`,
  });
  res.status(201).json(flight);
});

router.patch("/:id", requireAuth, requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const flight = await prisma.flight.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(flight);
  } catch {
    res.status(404).json({ error: "Flight not found" });
  }
});

// Status updates are open to Owner/Manager for any flight, but Flight Hosts/Pilots
// only for a flight they're actually crewing - checked here rather than in the
// shared permission matrix, since it depends on the specific flight, not just role.
router.patch("/:id/status", requireAuth, requirePermission(Permission.UPDATE_FLIGHT_STATUS), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const isManagement = req.user!.role === Role.OWNER || req.user!.role === Role.MANAGER;
  if (!isManagement) {
    const crewed = await prisma.crewAssignment.findFirst({
      where: { flightId: req.params.id, userId: req.user!.id },
    });
    if (!crewed) {
      return res.status(403).json({ error: "You're not crewing this flight" });
    }
  }

  try {
    const flight = await prisma.flight.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    recordAudit({
      actorId: req.user!.id,
      action: "flight.status_update",
      targetType: "Flight",
      targetId: flight.id,
      detail: `${flight.flightNumber} -> ${flight.status}`,
    });
    res.json(flight);
  } catch {
    res.status(404).json({ error: "Flight not found" });
  }
});

router.delete("/:id", requireAuth, requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  try {
    const flight = await prisma.flight.update({
      where: { id: req.params.id },
      data: { status: FlightStatus.CANCELLED },
    });
    recordAudit({
      actorId: req.user!.id,
      action: "flight.cancel",
      targetType: "Flight",
      targetId: flight.id,
      detail: flight.flightNumber,
    });
    res.json(flight);
  } catch {
    res.status(404).json({ error: "Flight not found" });
  }
});

// --- Crew assignments, nested under a flight ---

const crewSchema = z.object({
  userId: z.string().uuid(),
  position: z.nativeEnum(CrewPosition),
});

router.post("/:id/crew", requireAuth, requirePermission(Permission.MANAGE_CREW), async (req, res) => {
  const parsed = crewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const assignment = await prisma.crewAssignment.create({
      data: { flightId: req.params.id, userId: parsed.data.userId, position: parsed.data.position },
      include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    });
    recordAudit({
      actorId: req.user!.id,
      action: "crew.assign",
      targetType: "Flight",
      targetId: req.params.id,
      detail: `${assignment.user?.discordUsername} as ${assignment.position}`,
    });
    res.status(201).json(assignment);
  } catch {
    res.status(409).json({ error: "That user is already assigned to that position on this flight" });
  }
});

router.delete("/:id/crew/:assignmentId", requireAuth, requirePermission(Permission.MANAGE_CREW), async (req, res) => {
  try {
    const assignment = await prisma.crewAssignment.delete({ where: { id: req.params.assignmentId } });
    recordAudit({
      actorId: req.user!.id,
      action: "crew.remove",
      targetType: "Flight",
      targetId: assignment.flightId,
      detail: `removed ${assignment.position} assignment`,
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Assignment not found" });
  }
});

// CSV passenger manifest - handy for handing off to a gate/check-in crew, or just
// keeping an offline record. Same permission as viewing the manifest in-app.
router.get("/:id/manifest.csv", requireAuth, requirePermission(Permission.VIEW_ALL_BOOKINGS), async (req, res) => {
  const flight = await prisma.flight.findUnique({
    where: { id: req.params.id },
    include: { bookings: { include: { user: true } } },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const rows = [["Passenger", "Discord ID", "Seat", "Status", "Booked At"]];
  for (const b of flight.bookings) {
    rows.push([
      b.user.discordUsername,
      b.user.discordId,
      b.seatNumber ?? "",
      b.status,
      b.createdAt.toISOString(),
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${flight.flightNumber}-manifest.csv"`);
  res.send(csv);
});

export default router;
