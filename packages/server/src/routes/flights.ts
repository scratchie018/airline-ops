import { Router } from "express";
import { z } from "zod";
import { CrewPosition, FlightStatus, Permission, Role } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

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

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const status = req.query.status as FlightStatus | undefined;

  const where = { airlineId: req.membership!.airlineId, ...(status ? { status } : {}) };

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

router.get("/:id", async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
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

router.post("/", requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // The aircraft has to actually belong to this airline - otherwise a flight
  // could be scheduled against another airline's tail number.
  const aircraft = await prisma.aircraft.findFirst({
    where: { id: parsed.data.aircraftId, airlineId: req.membership!.airlineId },
  });
  if (!aircraft) return res.status(400).json({ error: "Aircraft not found" });

  try {
    const flight = await prisma.flight.create({
      data: { ...parsed.data, airlineId: req.membership!.airlineId, createdById: req.user!.id },
    });
    recordAudit({
      airlineId: req.membership!.airlineId,
      actorId: req.user!.id,
      action: "flight.create",
      targetType: "Flight",
      targetId: flight.id,
      detail: `${flight.flightNumber} ${flight.origin}->${flight.destination}`,
    });
    res.status(201).json(flight);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "That flight number is already in use" });
    throw err;
  }
});

router.patch("/:id", requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { count } = await prisma.flight.updateMany({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: "Flight not found" });

  const flight = await prisma.flight.findUnique({ where: { id: req.params.id } });
  res.json(flight);
});

// Status updates are open to Owner/Manager for any flight, but Flight Hosts/Pilots
// only for a flight they're actually crewing - checked here rather than in the
// shared permission matrix, since it depends on the specific flight, not just role.
router.patch("/:id/status", requirePermission(Permission.UPDATE_FLIGHT_STATUS), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const isManagement = req.membership!.role === Role.OWNER || req.membership!.role === Role.MANAGER;
  if (!isManagement) {
    const crewed = await prisma.crewAssignment.findFirst({
      where: { flightId: flight.id, userId: req.user!.id },
    });
    if (!crewed) {
      return res.status(403).json({ error: "You're not crewing this flight" });
    }
  }

  const updated = await prisma.flight.update({ where: { id: flight.id }, data: { status: parsed.data.status } });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "flight.status_update",
    targetType: "Flight",
    targetId: updated.id,
    detail: `${updated.flightNumber} -> ${updated.status}`,
  });
  res.json(updated);
});

router.delete("/:id", requirePermission(Permission.MANAGE_FLIGHTS), async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const updated = await prisma.flight.update({
    where: { id: flight.id },
    data: { status: FlightStatus.CANCELLED },
  });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "flight.cancel",
    targetType: "Flight",
    targetId: updated.id,
    detail: updated.flightNumber,
  });
  res.json(updated);
});

// --- Crew assignments, nested under a flight ---

const crewSchema = z.object({
  userId: z.string().uuid(),
  position: z.nativeEnum(CrewPosition),
});

router.post("/:id/crew", requirePermission(Permission.MANAGE_CREW), async (req, res) => {
  const parsed = crewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  // The assignee has to actually be a member of this airline.
  const member = await prisma.membership.findUnique({
    where: { userId_airlineId: { userId: parsed.data.userId, airlineId: req.membership!.airlineId } },
  });
  if (!member) return res.status(400).json({ error: "That user is not a member of this airline" });

  try {
    const assignment = await prisma.crewAssignment.create({
      data: { flightId: flight.id, userId: parsed.data.userId, position: parsed.data.position },
      include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    });
    recordAudit({
      airlineId: req.membership!.airlineId,
      actorId: req.user!.id,
      action: "crew.assign",
      targetType: "Flight",
      targetId: flight.id,
      detail: `${assignment.user?.discordUsername} as ${assignment.position}`,
    });
    res.status(201).json(assignment);
  } catch {
    res.status(409).json({ error: "That user is already assigned to that position on this flight" });
  }
});

router.delete("/:id/crew/:assignmentId", requirePermission(Permission.MANAGE_CREW), async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const { count } = await prisma.crewAssignment.deleteMany({
    where: { id: req.params.assignmentId, flightId: flight.id },
  });
  if (count === 0) return res.status(404).json({ error: "Assignment not found" });

  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "crew.remove",
    targetType: "Flight",
    targetId: flight.id,
    detail: "removed crew assignment",
  });
  res.status(204).send();
});

// CSV passenger manifest - handy for handing off to a gate/check-in crew, or just
// keeping an offline record. Same permission as viewing the manifest in-app.
router.get("/:id/manifest.csv", requirePermission(Permission.VIEW_ALL_BOOKINGS), async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.id, airlineId: req.membership!.airlineId },
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
