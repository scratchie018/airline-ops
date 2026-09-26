import { Router } from "express";
import { z } from "zod";
import { Permission } from "shared";
import { prisma } from "../db";
import { requireAirlineMembership, requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireAirlineMembership, requirePermission(Permission.USE_BRIEFING_TOOLS));

const EMPTY_BRIEF = {
  squawk: "",
  flightLevel: "",
  initialClimb: "",
  departureIcao: "",
  arrivalIcao: "",
  waypoints: "",
  departureRunway: "",
  departureTaxiInfo: "",
  arrivalRunway: "",
  arrivalTaxiInfo: "",
  atis: "",
  notam: "",
};

// One brief per (user, airline) - matches the standalone tool this was
// ported from, which only ever kept a single saved brief.json at a time.
router.get("/", async (req, res) => {
  const brief = await prisma.brief.findUnique({
    where: { userId_airlineId: { userId: req.user!.id, airlineId: req.membership!.airlineId } },
  });
  res.json(brief ?? { ...EMPTY_BRIEF, updatedAt: null });
});

const saveSchema = z.object({
  squawk: z.string().max(20).optional(),
  flightLevel: z.string().max(20).optional(),
  initialClimb: z.string().max(20).optional(),
  departureIcao: z.string().max(10).optional(),
  arrivalIcao: z.string().max(10).optional(),
  waypoints: z.string().max(4000).optional(),
  departureRunway: z.string().max(20).optional(),
  departureTaxiInfo: z.string().max(4000).optional(),
  arrivalRunway: z.string().max(20).optional(),
  arrivalTaxiInfo: z.string().max(4000).optional(),
  atis: z.string().max(4000).optional(),
  notam: z.string().max(4000).optional(),
});

router.put("/", async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const brief = await prisma.brief.upsert({
    where: { userId_airlineId: { userId: req.user!.id, airlineId: req.membership!.airlineId } },
    update: parsed.data,
    create: { ...EMPTY_BRIEF, ...parsed.data, userId: req.user!.id, airlineId: req.membership!.airlineId },
  });
  res.json(brief);
});

export default router;
