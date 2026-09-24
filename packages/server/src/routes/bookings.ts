import { Router } from "express";
import { z } from "zod";
import { BookingStatus, Permission, hasPermission } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../services/auditLog";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

const createSchema = z.object({
  seatNumber: z.string().max(10).optional(),
});

// Books the current user onto a flight. Wrapped in a transaction so two people
// booking the literal last seat at the same moment can't both succeed - matters
// once this is handling hundreds of concurrent passengers, not just for one person.
router.post("/flights/:flightId/bookings", requirePermission(Permission.BOOK_FLIGHT), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const flight = await tx.flight.findFirst({
        where: { id: req.params.flightId, airlineId: req.membership!.airlineId },
        include: { aircraft: true },
      });
      if (!flight) throw new Error("NOT_FOUND");

      const activeBookings = await tx.booking.count({
        where: { flightId: flight.id, status: { not: BookingStatus.CANCELLED } },
      });
      if (activeBookings >= flight.aircraft.seatCapacity) {
        throw new Error("FULL");
      }

      return tx.booking.create({
        data: { flightId: flight.id, userId: req.user!.id, seatNumber: parsed.data.seatNumber },
      });
    });
    res.status(201).json(booking);
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Flight not found" });
    if (err.message === "FULL") return res.status(409).json({ error: "Flight is fully booked" });
    if (err.code === "P2002") return res.status(409).json({ error: "You already have a booking on this flight" });
    console.error(err);
    res.status(500).json({ error: "Booking failed" });
  }
});

router.get("/flights/:flightId/bookings", requirePermission(Permission.VIEW_ALL_BOOKINGS), async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.flightId, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const bookings = await prisma.booking.findMany({
    where: { flightId: flight.id },
    include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(bookings);
});

router.get("/bookings/me", async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user!.id, flight: { airlineId: req.membership!.airlineId } },
    include: { flight: { include: { aircraft: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

const seatSchema = z.object({ seatNumber: z.string().max(10).nullable() });

// Staff assigning/changing a passenger's seat (as opposed to the passenger
// picking their own at booking time) - same permission as viewing the full
// manifest, since it's the same "staff manage the passenger list" capability.
router.patch("/bookings/:id/seat", requirePermission(Permission.VIEW_ALL_BOOKINGS), async (req, res) => {
  const parsed = seatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const booking = await prisma.booking.findFirst({
    where: { id: req.params.id, flight: { airlineId: req.membership!.airlineId } },
    include: { user: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { seatNumber: parsed.data.seatNumber },
  });
  recordAudit({
    airlineId: req.membership!.airlineId,
    actorId: req.user!.id,
    action: "booking.seat_assign",
    targetType: "Booking",
    targetId: booking.id,
    detail: `${booking.user.discordUsername}: ${booking.seatNumber ?? "unassigned"} -> ${updated.seatNumber ?? "unassigned"}`,
  });
  res.json(updated);
});

router.delete("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findFirst({
    where: { id: req.params.id, flight: { airlineId: req.membership!.airlineId } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isOwnBooking = booking.userId === req.user!.id;
  const canManageOthers = hasPermission(req.membership!.role, Permission.VIEW_ALL_BOOKINGS);
  if (!isOwnBooking && !canManageOthers) {
    return res.status(403).json({ error: "Not permitted" });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.CANCELLED },
  });
  res.json(updated);
});

export default router;
