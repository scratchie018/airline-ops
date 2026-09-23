import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./env";
import authRoutes from "./routes/auth";
import aircraftRoutes from "./routes/aircraft";
import flightRoutes from "./routes/flights";
import bookingRoutes from "./routes/bookings";
import usersRoutes from "./routes/users";
import adminRoutes from "./routes/admin";

const app = express();

app.use(
  cors({
    origin: [env.webOrigin, env.desktopRedirectOrigin],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/aircraft", aircraftRoutes);
app.use("/flights", flightRoutes);
app.use("/", bookingRoutes); // mounts /flights/:id/bookings and /bookings/*
app.use("/users", usersRoutes);
app.use("/admin", adminRoutes);

app.listen(env.port, () => {
  console.log(`Airline Ops API listening on :${env.port}`);
});
