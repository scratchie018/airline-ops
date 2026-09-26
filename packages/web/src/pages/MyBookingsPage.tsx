import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aircraft, Booking, Flight } from "shared";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

type BookingWithFlight = Booking & { flight: Flight & { aircraft: Aircraft } };

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithFlight[]>([]);

  async function load() {
    setBookings(await apiFetch<BookingWithFlight[]>("/bookings/me"));
  }

  useEffect(() => {
    load();
  }, []);
  useAutoRefresh(load);

  async function cancel(id: string) {
    await apiFetch(`/bookings/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4"><i className="fa-solid fa-ticket text-brand-400 mr-2" />My Bookings</h1>
      <div className="bg-accent border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-4 py-2">Flight</th>
              <th className="px-4 py-2">Route</th>
              <th className="px-4 py-2">Departs</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2">
                  <Link to={`/flights/${b.flight.id}`} className="font-medium text-brand-300 hover:underline">
                    {b.flight.flightNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {b.flight.origin} → {b.flight.destination}
                </td>
                <td className="px-4 py-2">{new Date(b.flight.departureTime).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {b.status !== "CANCELLED" && (
                    <button onClick={() => cancel(b.id)} className="text-tuired-400 hover:underline text-xs">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  You haven't booked any flights yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
