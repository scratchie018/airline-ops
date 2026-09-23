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

fixUpDefaultAirlineGuildId()
  .catch((err) => console.error("Default airline guild ID backfill failed:", err))
  .finally(() => {
    app.listen(env.port, () => {
      console.log(`Airline Ops API listening on :${env.port}`);
    });
  });
