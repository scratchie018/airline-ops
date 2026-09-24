import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aircraft, Flight, FlightStatus, Paginated, Permission } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";

const STATUS_FILTERS: (FlightStatus | "ALL")[] = [
  "ALL",
  FlightStatus.SCHEDULED,
  FlightStatus.BOARDING,
  FlightStatus.DEPARTED,
  FlightStatus.EN_ROUTE,
  FlightStatus.LANDED,
  FlightStatus.CANCELLED,
];

export default function FlightsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [flights, setFlights] = useState<(Flight & { aircraft: Aircraft })[]>([]);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlightStatus | "ALL">("ALL");

  const [flightNumber, setFlightNumber] = useState("");
  const [aircraftId, setAircraftId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");

  async function load() {
    const params = new URLSearchParams({ pageSize: "100" });
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await apiFetch<Paginated<Flight & { aircraft: Aircraft }>>(`/flights?${params}`);
    setFlights(res.items);
  }

  useEffect(() => {
    load();
    if (can(Permission.MANAGE_FLIGHTS)) {
      apiFetch<Paginated<Aircraft>>("/aircraft?pageSize=100").then((r) => {
        setFleet(r.items.filter((a) => a.status === "ACTIVE"));
      });
    }
  }, []);

  // Debounced re-fetch on search/status change, rather than filtering
  // client-side, so this scales past the first page of flights too.
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [search, statusFilter]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/flights", {
        method: "POST",
        body: JSON.stringify({
          flightNumber,
          aircraftId,
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          departureTime: new Date(departureTime).toISOString(),
          arrivalTime: new Date(arrivalTime).toISOString(),
        }),
      });
      toast.success(`${flightNumber} scheduled`);
      setFlightNumber("");
      setOrigin("");
      setDestination("");
      setDepartureTime("");
      setArrivalTime("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold shrink-0"><i className="fa-solid fa-plane text-brand-400 mr-2" />Flights</h1>
        {can(Permission.MANAGE_FLIGHTS) && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap"
          >
            <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} mr-1.5`} />
            {showForm ? "Cancel" : "Schedule flight"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative max-w-xs w-full">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flight # or route..."
            className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm bg-accent text-ink placeholder:text-ink-muted"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FlightStatus | "ALL")}
          className="border rounded-lg px-2 py-1.5 text-sm bg-accent text-ink"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="bg-accent border rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Flight number</label>
            <input required value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted" placeholder="AO123" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Aircraft</label>
            <select required value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted">
              <option value="">Select...</option>
              {fleet.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tailNumber} - {a.model}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div>
            <label className="block text-xs text-ink-muted mb-1">Origin</label>
            <input required value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted" placeholder="KJFK" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Destination</label>
            <input required value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted" placeholder="KLAX" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-ink-muted mb-1">Departure</label>
            <input required type="datetime-local" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Arrival</label>
            <input required type="datetime-local" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted" />
          </div>
          <div className="flex items-end">
            <button className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 rounded-lg w-full">
              Save
            </button>
          </div>
          {error && <p className="text-sm text-tuired-400 col-span-full">{error}</p>}
        </form>
      )}

      <div className="bg-accent border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-4 py-2">Flight</th>
              <th className="px-4 py-2">Route</th>
              <th className="px-4 py-2">Departs</th>
              <th className="px-4 py-2">Aircraft</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {flights.map((f) => (
              <tr key={f.id} className="hover:bg-bg">
                <td className="px-4 py-2">
                  <Link to={`/flights/${f.id}`} className="font-medium text-brand-300 hover:underline">
                    {f.flightNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {f.origin} → {f.destination}
                </td>
                <td className="px-4 py-2">{new Date(f.departureTime).toLocaleString()}</td>
                <td className="px-4 py-2">{f.aircraft?.tailNumber}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={f.status} />
                </td>
              </tr>
            ))}
            {flights.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  {search || statusFilter !== "ALL" ? "No flights match your filters." : "No flights yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
