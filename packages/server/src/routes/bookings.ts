import { Router } from "express";
import { z } from "zod";
import { BookingStatus, Permission, hasPermission } from "shared";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  seatNumber: z.string().max(10).optional(),
});

// Books the current user onto a flight. Wrapped in a transaction so two people
// booking the literal last seat at the same moment can't both succeed - matters
// once this is handling hundreds of concurrent passengers, not just for one person.
router.post("/flights/:flightId/bookings", requireAuth, requirePermission(Permission.BOOK_FLIGHT), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const flight = await tx.flight.findUnique({
        where: { id: req.params.flightId },
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

router.get("/flights/:flightId/bookings", requireAuth, requirePermission(Permission.VIEW_ALL_BOOKINGS), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { flightId: req.params.flightId },
    include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(bookings);
});

router.get("/bookings/me", requireAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user!.id },
    include: { flight: { include: { aircraft: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

router.delete("/bookings/:id", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isOwnBooking = booking.userId === req.user!.id;
  const canManageOthers = hasPermission(req.user!.role, Permission.VIEW_ALL_BOOKINGS);
  if (!isOwnBooking && !canManageOthers) {
    return res.status(403).json({ error: "Not permitted" });
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: BookingStatus.CANCELLED },
  });
  res.json(updated);
});

export default router;
