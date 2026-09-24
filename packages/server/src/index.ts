import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./env";
import { prisma } from "./db";
import authRoutes from "./routes/auth";
import airlineRoutes from "./routes/airlines";
import aircraftRoutes from "./routes/aircraft";
import flightRoutes from "./routes/flights";
import bookingRoutes from "./routes/bookings";
import drinkOrderRoutes from "./routes/drinkOrders";
import usersRoutes from "./routes/users";
import adminRoutes from "./routes/admin";

const app = express();

app.use(
  cors({
    origin: env.webOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/airlines", airlineRoutes);
app.use("/aircraft", aircraftRoutes);
app.use("/flights", flightRoutes);
app.use("/", bookingRoutes); // mounts /flights/:id/bookings and /bookings/*
app.use("/", drinkOrderRoutes); // mounts /flights/:id/drink-orders and /drink-orders/*
app.use("/users", usersRoutes);
app.use("/admin", adminRoutes);

/** The multi-airline migration can't put a real Discord guild ID into a
 * committed migration file (secrets don't belong in git), so it leaves the
 * one default airline it creates from pre-existing data with a placeholder
 * "pending-setup-..." discordGuildId. This fixes that up using the guild ID
 * already sitting in this server's own env vars - a one-time no-op after the
 * first successful run, since the placeholder won't exist anymore. */
async function fixUpDefaultAirlineGuildId() {
  if (!env.discordGuildId) return;
  const placeholder = await prisma.airline.findFirst({
    where: { discordGuildId: { startsWith: "pending-setup-" } },
  });
  if (!placeholder) return;
  await prisma.airline.update({
    where: { id: placeholder.id },
    data: { discordGuildId: env.discordGuildId },
  });
  console.log(`Backfilled default airline ${placeholder.id}'s Discord guild ID from env.`);
}

/** One-time data fix, same pattern as fixUpDefaultAirlineGuildId above - no
 * production DB credentials exist outside Render's own dashboard, so a fix
 * like this ships as an idempotent boot step instead. Gives quebecnotfound a
 * locked Owner Membership on every Airline that exists right now. Meant to
 * be removed again once confirmed applied, not a permanent rule for future
 * airlines. */
async function grantQuebecnotfoundOwnerEverywhere() {
  const user = await prisma.user.findFirst({ where: { discordUsername: "quebecnotfound" } });
  if (!user) return;

  const airlines = await prisma.airline.findMany({ select: { id: true } });
  for (const airline of airlines) {
    await prisma.membership.upsert({
      where: { userId_airlineId: { userId: user.id, airlineId: airline.id } },
      update: { role: "OWNER", roleLocked: true },
      create: { userId: user.id, airlineId: airline.id, role: "OWNER", roleLocked: true },
    });
  }
  console.log(`Granted quebecnotfound OWNER on ${airlines.length} airline(s).`);
}

Promise.all([fixUpDefaultAirlineGuildId(), grantQuebecnotfoundOwnerEverywhere()])
  .catch((err) => console.error("Boot-time data fixups failed:", err))
  .finally(() => {
    app.listen(env.port, () => {
      console.log(`Airline Ops API listening on :${env.port}`);
    });
  });
