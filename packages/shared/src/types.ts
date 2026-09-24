/** The 5 account classes. Assigned automatically at login by mapping the user's
 * Discord server roles to one of these (see server/src/services/discordAuth.ts) -
 * never set directly by the client. */
export enum Role {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  FLIGHT_HOST = "FLIGHT_HOST",
  PILOT = "PILOT",
  PASSENGER = "PASSENGER",
}

export enum FlightStatus {
  SCHEDULED = "SCHEDULED",
  BOARDING = "BOARDING",
  DEPARTED = "DEPARTED",
  EN_ROUTE = "EN_ROUTE",
  LANDED = "LANDED",
  CANCELLED = "CANCELLED",
}

export enum AircraftStatus {
  ACTIVE = "ACTIVE",
  MAINTENANCE = "MAINTENANCE",
  RETIRED = "RETIRED",
}

/** The position someone is crewing a specific flight as - distinct from their
 * account-wide Role (a MANAGER could still crew a flight as a PILOT, say). */
export enum CrewPosition {
  PILOT = "PILOT",
  FLIGHT_HOST = "FLIGHT_HOST",
}

export enum BookingStatus {
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CANCELLED = "CANCELLED",
}

export enum DrinkOrderStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export interface User {
  id: string;
  discordId: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  createdAt: string;
}

/** One virtual airline "workspace" - the multi-tenancy boundary. */
export interface Airline {
  id: string;
  name: string;
  slug: string;
  discordGuildId: string;
  discordWebhookUrl: string | null;
  createdAt: string;
}

/** The signed-in user's membership (and Role) in one specific airline - a
 * Discord account can hold a different Membership in several airlines at
 * once, which is why Role lives here rather than on User. */
export interface Membership {
  id: string;
  airlineId: string;
  role: Role;
  airline: Airline;
}

export interface Aircraft {
  id: string;
  tailNumber: string;
  model: string;
  seatCapacity: number;
  status: AircraftStatus;
  createdAt: string;
}

export interface Flight {
  id: string;
  flightNumber: string;
  aircraftId: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  status: FlightStatus;
  createdById: string;
  createdAt: string;
}

export interface CrewAssignment {
  id: string;
  flightId: string;
  userId: string;
  position: CrewPosition;
  createdAt: string;
  user?: Pick<User, "id" | "discordUsername" | "discordAvatarUrl">;
}

export interface Booking {
  id: string;
  flightId: string;
  userId: string;
  seatNumber: string | null;
  status: BookingStatus;
  createdAt: string;
  user?: Pick<User, "id" | "discordUsername" | "discordAvatarUrl">;
}

export interface DrinkOrder {
  id: string;
  flightId: string;
  userId: string;
  item: string;
  status: DrinkOrderStatus;
  createdAt: string;
  user?: Pick<User, "id" | "discordUsername" | "discordAvatarUrl">;
}

/** Flight with its related records attached, as returned by GET /flights/:id */
export interface FlightDetail extends Flight {
  aircraft: Aircraft;
  crew: CrewAssignment[];
  bookings: Booking[];
  seatsAvailable: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Maps one Discord role ID (in one airline's server) to one app Role -
 * configured by that airline's Owner instead of hardcoded server env vars.
 * See packages/server's RoleMapping model. */
export interface RoleMapping {
  id: string;
  airlineId: string;
  discordRoleId: string;
  appRole: Role;
  label: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  actor?: Pick<User, "id" | "discordUsername" | "discordAvatarUrl">;
}
