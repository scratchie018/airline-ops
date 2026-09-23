import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CrewPosition, FlightDetail, FlightStatus, Permission, Role, User } from "shared";
import { apiFetch, downloadFile } from "../api";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/StatusBadge";

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
  const [flight, setFlight] = useState<FlightDetail | null>(null);
  const [crewOptions, setCrewOptions] = useState<CrewEligibleUser[]>([]);
  const [crewUserId, setCrewUserId] = useState("");
  const [crewPosition, setCrewPosition] = useState<CrewPosition>(CrewPosition.PILOT);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const f = await apiFetch<FlightDetail>(`/flights/${id}`);
    setFlight(f);
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
      setCrewUserId("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeCrew(assignmentId: string) {
    await apiFetch(`/flights/${id}/crew/${assignmentId}`, { method: "DELETE" });
    load();
  }

  async function book() {
    setError(null);
    try {
      await apiFetch(`/flights/${id}/bookings`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancelBooking(bookingId: string) {
    await apiFetch(`/bookings/${bookingId}`, { method: "DELETE" });
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
            <ul className="space-y-1">
              {flight.bookings
                .filter((b) => b.status !== "CANCELLED")
                .map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span>{b.user?.discordUsername}</span>
                    <button onClick={() => cancelBooking(b.id)} className="text-tuired-400 hover:underline text-xs">
                      Cancel
                    </button>
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
    </div>
  );
}
