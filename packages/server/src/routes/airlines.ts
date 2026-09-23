import { Router } from "express";
import { z } from "zod";
import { Role } from "shared";
import { prisma } from "../db";
import { env } from "../env";
import { requireAuth } from "../middleware/auth";
import { isBotInGuild } from "../services/discordAuth";

const DISCORD_API = "https://discord.com/api/v10";

const router = Router();

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "airline";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  // Airline count per name collision is expected to be tiny - a simple loop
  // beats a more clever scheme for something this low-volume.
  while (await prisma.airline.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

router.get("/mine", requireAuth, async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user!.id },
    include: { airline: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(memberships);
});

const createSchema = z.object({
  name: z.string().min(2).max(80),
  discordGuildId: z.string().min(1).max(32),
});

// Self-serve airline creation - anyone signed in with Discord can register a
// new airline against a Discord server they belong to (checked below with the
// bot token, the same way role sync checks membership) and becomes its Owner.
router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, discordGuildId } = parsed.data;

  const botIn = await isBotInGuild(discordGuildId);
  if (!botIn) {
    return res.status(400).json({
      error: "The Airline Ops bot isn't in that Discord server yet - invite it first, then try again.",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const memberRes = await fetch(`${DISCORD_API}/guilds/${discordGuildId}/members/${user!.discordId}`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });
  if (memberRes.status === 404) {
    return res.status(400).json({ error: "You need to be a member of that Discord server to register it here." });
  }

  const existing = await prisma.airline.findUnique({ where: { discordGuildId } });
  if (existing) {
    return res.status(409).json({ error: "That Discord server is already registered to an airline here." });
  }

  const slug = await uniqueSlug(name);

  const airline = await prisma.airline.create({
    data: {
      name,
      slug,
      discordGuildId,
      createdById: req.user!.id,
      memberships: { create: { userId: req.user!.id, role: Role.OWNER } },
    },
  });

  res.status(201).json(airline);
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  discordGuildId: z.string().min(1).max(32).optional(),
});

// Owner-only, checked manually here rather than via requireAirlineMembership +
// requirePermission since this route isn't nested under the usual X-Airline-Id
// flow (the airline is named in the URL, and editing it has to work even for
// the placeholder-guild default airline the multi-airline migration created,
// before its Owner has "selected" it anywhere).
router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const membership = await prisma.membership.findUnique({
    where: { userId_airlineId: { userId: req.user!.id, airlineId: req.params.id } },
  });
  if (!membership || membership.role !== Role.OWNER) {
    return res.status(403).json({ error: "Only that airline's Owner can edit it" });
  }

  if (parsed.data.discordGuildId) {
    const botIn = await isBotInGuild(parsed.data.discordGuildId);
    if (!botIn) {
      return res.status(400).json({
        error: "The Airline Ops bot isn't in that Discord server yet - invite it first, then try again.",
      });
    }
  }

  try {
    const airline = await prisma.airline.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(airline);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(409).json({ error: "That Discord server is already registered to another airline" });
    throw err;
  }
});

export default router;
