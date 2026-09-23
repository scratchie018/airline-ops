import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flight, Paginated } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Flight[]>([]);

  useEffect(() => {
    function load() {
      apiFetch<Paginated<Flight>>("/flights?status=SCHEDULED&pageSize=5").then((r) => setUpcoming(r.items));
    }
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 text-ink">Welcome back, {user?.discordUsername}</h1>
      <p className="text-ink-muted mb-6">You're signed in as {user?.role.replace("_", " ")}.</p>

      <div className="bg-accent border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink flex items-center gap-2">
            <i className="fa-solid fa-plane text-brand-400" /> Upcoming flights
          </h2>
          <Link to="/flights" className="text-sm text-brand-300 hover:text-brand-200 hover:underline">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-muted">No scheduled flights yet.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((f) => (
              <li key={f.id} className="py-2 flex items-center justify-between">
                <Link to={`/flights/${f.id}`} className="hover:underline text-ink">
                  <span className="font-medium">{f.flightNumber}</span>{" "}
                  <span className="text-ink-muted">
                    {f.origin} → {f.destination}
                  </span>
                </Link>
                <StatusBadge status={f.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
