import { Router } from "express";
import { z } from "zod";
import { DrinkOrderStatus, MENU_ITEM_NAMES, Permission } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireAirlineMembership);

const createSchema = z.object({
  item: z.enum(MENU_ITEM_NAMES),
});

// A passenger orders a drink or snack for themselves on a flight they're
// actually booked on - mirrors the booking flow's own ownership check.
router.post("/flights/:flightId/drink-orders", requirePermission(Permission.ORDER_DRINKS), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const flight = await prisma.flight.findFirst({
    where: { id: req.params.flightId, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const booking = await prisma.booking.findFirst({
    where: { flightId: flight.id, userId: req.user!.id, status: { not: "CANCELLED" } },
  });
  if (!booking) {
    return res.status(403).json({ error: "You need a booking on this flight to order food or drinks" });
  }

  const order = await prisma.drinkOrder.create({
    data: { flightId: flight.id, userId: req.user!.id, item: parsed.data.item },
  });
  res.status(201).json(order);
});

// Crew-facing: every order on the flight, for whoever's serving to fulfill.
router.get("/flights/:flightId/drink-orders", requirePermission(Permission.MANAGE_DRINK_ORDERS), async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.flightId, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const orders = await prisma.drinkOrder.findMany({
    where: { flightId: flight.id },
    include: { user: { select: { id: true, discordUsername: true, discordAvatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(orders);
});

// Passenger-facing: just their own orders on this flight.
router.get("/flights/:flightId/drink-orders/mine", async (req, res) => {
  const flight = await prisma.flight.findFirst({
    where: { id: req.params.flightId, airlineId: req.membership!.airlineId },
  });
  if (!flight) return res.status(404).json({ error: "Flight not found" });

  const orders = await prisma.drinkOrder.findMany({
    where: { flightId: flight.id, userId: req.user!.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(orders);
});

const statusSchema = z.object({ status: z.nativeEnum(DrinkOrderStatus) });

router.patch("/drink-orders/:id/status", requirePermission(Permission.MANAGE_DRINK_ORDERS), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { count } = await prisma.drinkOrder.updateMany({
    where: { id: req.params.id, flight: { airlineId: req.membership!.airlineId } },
    data: { status: parsed.data.status },
  });
  if (count === 0) return res.status(404).json({ error: "Order not found" });

  const order = await prisma.drinkOrder.findUnique({ where: { id: req.params.id } });
  res.json(order);
});

export default router;
