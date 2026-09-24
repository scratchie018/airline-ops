import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CrewPosition,
  DrinkOrder,
  DrinkOrderStatus,
  FlightDetail,
  FlightStatus,
  MENU_ITEMS,
  MenuItemName,
  Permission,
  Role,
  User,
} from "shared";
import { apiFetch, downloadFile } from "../api";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";

// Live status polling: a Flight Host marking BOARDING should show up for everyone
// else already looking at this flight (gate staff, passengers, dashboard) without
// them needing to manually refresh - this is the whole point of "live" flight ops.
const LIVE_REFRESH_MS = 8000;

const STATUS_FLOW: FlightStatus[] = [
  FlightStatus.SCHEDULED,
  FlightStatus.BOARDING,
  FlightStatus.DEPARTED,
  FlightStatus.EN_ROUTE,
  FlightStatus.LANDED,
];

type CrewEligibleUser = Pick<User, "id" | "discordUsername" | "discordAvatarUrl"> & { role: Role };

export default function FlightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, currentMembership, can } = useAuth();
  const toast = useToast();
  const [flight, setFlight] = useState<FlightDetail | null>(null);
  const [crewOptions, setCrewOptions] = useState<CrewEligibleUser[]>([]);
  const [crewUserId, setCrewUserId] = useState("");
  const [crewPosition, setCrewPosition] = useState<CrewPosition>(CrewPosition.PILOT);
  const [myDrinkOrders, setMyDrinkOrders] = useState<DrinkOrder[]>([]);
  const [allDrinkOrders, setAllDrinkOrders] = useState<DrinkOrder[]>([]);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [seatDrafts, setSeatDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const f = await apiFetch<FlightDetail>(`/flights/${id}`);
    setFlight(f);
    if (can(Permission.ORDER_DRINKS)) {
      apiFetch<DrinkOrder[]>(`/flights/${id}/drink-orders/mine`).then(setMyDrinkOrders);
    }
    if (can(Permission.MANAGE_DRINK_ORDERS)) {
      apiFetch<DrinkOrder[]>(`/flights/${id}/drink-orders`).then(setAllDrinkOrders);
    }
  }

  useEffect(() => {
    load();
    if (can(Permission.MANAGE_CREW)) {
      apiFetch<CrewEligibleUser[]>("/users/crew-eligible").then(setCrewOptions);
    }
    const interval = setInterval(load, LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [id]);

  if (!flight) return <p className="text-ink-muted">Loading...</p>;

  const isManagement = currentMembership?.role === Role.OWNER || currentMembership?.role === Role.MANAGER;
  const isCrewingThisFlight = flight.crew.some((c) => c.userId === user?.id);
  const canUpdateStatus = can(Permission.UPDATE_FLIGHT_STATUS) && (isManagement || isCrewingThisFlight);

  const myBooking = flight.bookings.find((b) => b.userId === user?.id && b.status !== "CANCELLED");
  const canBook = can(Permission.BOOK_FLIGHT) && !myBooking && flight.seatsAvailable > 0 && flight.status === "SCHEDULED";

  async function setStatus(status: FlightStatus) {
    setError(null);
    try {
      await apiFetch(`/flights/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`Flight marked as ${status.replace("_", " ")}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addCrew(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/flights/${id}/crew`, {
        method: "POST",
        body: JSON.stringify({ userId: crewUserId, position: crewPosition }),
      });
      toast.success("Crew member added");
      setCrewUserId("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeCrew(assignmentId: string) {
    await apiFetch(`/flights/${id}/crew/${assignmentId}`, { method: "DELETE" });
    toast.success("Crew member removed");
    load();
  }

  async function book() {
    setError(null);
    try {
      await apiFetch(`/flights/${id}/bookings`, { method: "POST", body: JSON.stringify({}) });
      toast.success("You're booked!");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancelBooking(bookingId: string) {
    await apiFetch(`/bookings/${bookingId}`, { method: "DELETE" });
    toast.success("Booking cancelled");
    load();
  }

  async function assignSeat(bookingId: string, currentSeat: string | null) {
    // Falls back to the booking's existing seat, matching what the input
    // actually displays when nobody's typed a draft yet - otherwise clicking
    // "Set" without editing anything would submit an empty value and silently
    // clear a seat that visibly still showed a number.
    const raw = seatDrafts[bookingId] ?? currentSeat ?? "";
    const seatNumber = raw.trim() || null;
    try {
      await apiFetch(`/bookings/${bookingId}/seat`, { method: "PATCH", body: JSON.stringify({ seatNumber }) });
      toast.success(seatNumber ? `Seat set to ${seatNumber}` : "Seat unassigned");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function orderItem(item: MenuItemName) {
    setError(null);
    setOrdering(item);
    try {
      await apiFetch(`/flights/${id}/drink-orders`, { method: "POST", body: JSON.stringify({ item }) });
      toast.success(`Ordered ${item}`);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOrdering(null);
    }
  }

  async function fulfillDrink(orderId: string, status: DrinkOrderStatus) {
    await apiFetch(`/drink-orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    toast.success("Order marked delivered");
    load();
  }

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(flight.status) + 1];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{flight.flightNumber}</h1>
          <StatusBadge status={flight.status} />
        </div>
        <p className="text-ink-muted">
          {flight.origin} → {flight.destination} · {flight.aircraft.tailNumber} ({flight.aircraft.model}) ·{" "}
          {new Date(flight.departureTime).toLocaleString()}
        </p>
      </div>

      {error && <p className="text-sm text-tuired-400">{error}</p>}

      {canUpdateStatus && flight.status !== "CANCELLED" && (
        <div className="bg-accent border rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm font-medium">Update status:</span>
          {nextStatus && (
            <button
              onClick={() => setStatus(nextStatus)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              Mark as {nextStatus.replace("_", " ")}
            </button>
          )}
          {can(Permission.MANAGE_FLIGHTS) && flight.status !== "LANDED" && (
            <button
              onClick={() => setStatus(FlightStatus.CANCELLED)}
              className="text-tuired-400 hover:underline text-sm"
            >
              Cancel flight
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-accent border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Crew</h2>
          <ul className="space-y-2 mb-3">
            {flight.crew.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.user?.discordUsername} <span className="text-ink-muted">· {c.position.replace("_", " ")}</span>
                </span>
                {can(Permission.MANAGE_CREW) && (
                  <button onClick={() => removeCrew(c.id)} className="text-tuired-400 hover:underline text-xs">
                    Remove
                  </button>
                )}
              </li>
            ))}
            {flight.crew.length === 0 && <p className="text-sm text-ink-muted">No crew assigned yet.</p>}
          </ul>
          {can(Permission.MANAGE_CREW) && (
            <form onSubmit={addCrew} className="flex gap-2">
              <select
                required
                value={crewUserId}
                onChange={(e) => setCrewUserId(e.target.value)}
                className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink"
              >
                <option value="">Select crew member...</option>
                {crewOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.discordUsername} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
              <select
                value={crewPosition}
                onChange={(e) => setCrewPosition(e.target.value as CrewPosition)}
                className="border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
              >
                <option value={CrewPosition.PILOT}>Pilot</option>
                <option value={CrewPosition.FLIGHT_HOST}>Flight Host</option>
              </select>
              <button className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 rounded-lg">
                Add
              </button>
            </form>
          )}
        </div>

        <div className="bg-accent border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Passengers</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">{flight.seatsAvailable} seats left</span>
              {can(Permission.VIEW_ALL_BOOKINGS) && (
                <button
                  onClick={() => downloadFile(`/flights/${id}/manifest.csv`, `${flight.flightNumber}-manifest.csv`)}
                  className="text-xs text-brand-300 hover:text-brand-200 hover:underline"
                >
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {canBook && (
            <button
              onClick={book}
              className="w-full mb-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-2 rounded-lg"
            >
              <i className="fa-solid fa-ticket mr-1.5" />
              Book this flight
            </button>
          )}
          {myBooking && (
            <div className="mb-3 flex items-center justify-between bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 text-sm rounded-lg px-3 py-2">
              <span>You're booked{myBooking.seatNumber ? ` - seat ${myBooking.seatNumber}` : ""}</span>
              <button onClick={() => cancelBooking(myBooking.id)} className="hover:underline text-xs">
                Cancel
              </button>
            </div>
          )}

          {can(Permission.VIEW_ALL_BOOKINGS) ? (
            <ul className="space-y-1.5">
              {flight.bookings
                .filter((b) => b.status !== "CANCELLED")
                .map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{b.user?.discordUsername}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        value={seatDrafts[b.id] ?? b.seatNumber ?? ""}
                        onChange={(e) => setSeatDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                        placeholder="Seat"
                        className="w-16 border rounded-md px-1.5 py-0.5 text-xs bg-bg text-ink placeholder:text-ink-muted"
                      />
                      <button
                        onClick={() => assignSeat(b.id, b.seatNumber)}
                        className="text-brand-300 hover:text-brand-200 hover:underline text-xs"
                      >
                        Set
                      </button>
                      <button onClick={() => cancelBooking(b.id)} className="text-tuired-400 hover:underline text-xs">
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              {flight.bookings.filter((b) => b.status !== "CANCELLED").length === 0 && (
                <p className="text-sm text-ink-muted">No bookings yet.</p>
              )}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Passenger manifest is only visible to staff.</p>
          )}
        </div>
      </div>

      {myBooking && can(Permission.ORDER_DRINKS) && (
        <div className="bg-accent border rounded-xl p-4">
          <h2 className="font-semibold mb-3">
            <i className="fa-solid fa-martini-glass-citrus text-brand-400 mr-1.5" />
            Cabin service
          </h2>

          {(["drink", "snack"] as const).map((category) => (
            <div key={category} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
                {category === "drink" ? "Drinks" : "Snacks"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MENU_ITEMS.filter((item) => item.category === category).map((item) => (
                  <button
                    key={item.name}
                    onClick={() => orderItem(item.name)}
                    disabled={ordering === item.name}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-bg/40 hover:bg-outline/10 disabled:opacity-60 text-center transition-colors"
                  >
                    <img src={item.imageUrl} alt="" className="w-12 h-12 object-contain" loading="lazy" />
                    <span className="text-xs text-ink leading-tight">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {myDrinkOrders.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Your orders</h3>
              <ul className="space-y-1">
                {myDrinkOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <span>{o.item}</span>
                    <span
                      className={`text-xs ${
                        o.status === "DELIVERED" ? "text-emerald-400" : o.status === "CANCELLED" ? "text-ink-muted" : "text-brand-300"
                      }`}
                    >
                      {o.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {can(Permission.MANAGE_DRINK_ORDERS) && (
        <div className="bg-accent border rounded-xl p-4">
          <h2 className="font-semibold mb-3">
            <i className="fa-solid fa-martini-glass-citrus text-brand-400 mr-1.5" />
            Cabin service orders to fulfill
          </h2>
          <ul className="space-y-2">
            {allDrinkOrders
              .filter((o) => o.status === "PENDING")
              .map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span>
                    {o.item} <span className="text-ink-muted">· {o.user?.discordUsername}</span>
                  </span>
                  <button
                    onClick={() => fulfillDrink(o.id, DrinkOrderStatus.DELIVERED)}
                    className="text-xs text-brand-300 hover:text-brand-200 hover:underline"
                  >
                    Mark delivered
                  </button>
                </li>
              ))}
            {allDrinkOrders.filter((o) => o.status === "PENDING").length === 0 && (
              <p className="text-sm text-ink-muted">No pending orders.</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
