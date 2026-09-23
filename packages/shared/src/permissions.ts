import { Role } from "./types";

/** Every distinct action the app gates by role. Kept as one flat enum (rather than
 * scattering role checks around) so the permission matrix below is the single place
 * that defines "who can do what" - the server enforces this for real, the frontend
 * uses the same table purely to decide what to show/hide. */
export enum Permission {
  MANAGE_AIRCRAFT = "MANAGE_AIRCRAFT",
  MANAGE_FLIGHTS = "MANAGE_FLIGHTS",
  MANAGE_CREW = "MANAGE_CREW",
  UPDATE_FLIGHT_STATUS = "UPDATE_FLIGHT_STATUS",
  VIEW_ALL_BOOKINGS = "VIEW_ALL_BOOKINGS",
  BOOK_FLIGHT = "BOOK_FLIGHT",
  MANAGE_USER_ROLES = "MANAGE_USER_ROLES",
  // Split out from MANAGE_USER_ROLES so an Owner can let Managers configure
  // which Discord roles map to which app roles ("custom roles") without also
  // handing them the more sensitive per-user manual override / audit log
  // access, which stays Owner-only.
  MANAGE_ROLE_MAPPINGS = "MANAGE_ROLE_MAPPINGS",
  ORDER_DRINKS = "ORDER_DRINKS",
  MANAGE_DRINK_ORDERS = "MANAGE_DRINK_ORDERS",
}

const MATRIX: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    Permission.MANAGE_AIRCRAFT,
    Permission.MANAGE_FLIGHTS,
    Permission.MANAGE_CREW,
    Permission.UPDATE_FLIGHT_STATUS,
    Permission.VIEW_ALL_BOOKINGS,
    Permission.BOOK_FLIGHT,
    Permission.MANAGE_USER_ROLES,
    Permission.MANAGE_ROLE_MAPPINGS,
    Permission.ORDER_DRINKS,
    Permission.MANAGE_DRINK_ORDERS,
  ],
  [Role.MANAGER]: [
    Permission.MANAGE_AIRCRAFT,
    Permission.MANAGE_FLIGHTS,
    Permission.MANAGE_CREW,
    Permission.UPDATE_FLIGHT_STATUS,
    Permission.VIEW_ALL_BOOKINGS,
    Permission.BOOK_FLIGHT,
    Permission.MANAGE_ROLE_MAPPINGS,
    Permission.ORDER_DRINKS,
    Permission.MANAGE_DRINK_ORDERS,
  ],
  [Role.FLIGHT_HOST]: [
    Permission.MANAGE_FLIGHTS,
    // Can update status only on flights they're crewing - that extra check is
    // done at the route level (see server/src/routes/flights.ts), not here.
    Permission.UPDATE_FLIGHT_STATUS,
    Permission.VIEW_ALL_BOOKINGS,
    Permission.BOOK_FLIGHT,
    Permission.ORDER_DRINKS,
    Permission.MANAGE_DRINK_ORDERS,
  ],
  [Role.PILOT]: [
    Permission.UPDATE_FLIGHT_STATUS,
    Permission.BOOK_FLIGHT,
    Permission.ORDER_DRINKS,
  ],
  [Role.PASSENGER]: [Permission.BOOK_FLIGHT, Permission.ORDER_DRINKS],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

/** Roles allowed to be assigned as crew on a flight (as opposed to the account-wide Role). */
export const CREW_ELIGIBLE_ROLES = [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT];
