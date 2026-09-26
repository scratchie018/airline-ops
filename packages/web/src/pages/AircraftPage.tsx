import { FormEvent, useEffect, useMemo, useState } from "react";
import { AIRCRAFT_MODELS, Aircraft, Paginated, Permission } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../components/Toast";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

export default function AircraftPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tailNumber, setTailNumber] = useState("");
  const [model, setModel] = useState("");
  const [seatCapacity, setSeatCapacity] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    const res = await apiFetch<Paginated<Aircraft>>("/aircraft?pageSize=100");
    setFleet(res.items);
  }

  useEffect(() => {
    load();
  }, []);
  useAutoRefresh(load);

  const visibleFleet = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fleet;
    return fleet.filter((a) => a.tailNumber.toLowerCase().includes(q) || a.model.toLowerCase().includes(q));
  }, [fleet, search]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/aircraft", {
        method: "POST",
        body: JSON.stringify({ tailNumber, model, seatCapacity: Number(seatCapacity) }),
      });
      toast.success(`${tailNumber} added to the fleet`);
      setTailNumber("");
      setModel("");
      setSeatCapacity(150);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function retire(a: Aircraft) {
    if (!(await confirm({ message: `Retire ${a.tailNumber}? It'll be hidden from new flight scheduling.`, confirmLabel: "Retire", danger: true }))) return;
    await apiFetch(`/aircraft/${a.id}`, { method: "DELETE" });
    toast.success(`${a.tailNumber} retired`);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold shrink-0"><i className="fa-solid fa-warehouse text-brand-400 mr-2" />Fleet</h1>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tail # or model..."
              className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm bg-accent text-ink placeholder:text-ink-muted"
            />
          </div>
          {can(Permission.MANAGE_AIRCRAFT) && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"} mr-1.5`} />
              {showForm ? "Cancel" : "Add aircraft"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="bg-accent border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Tail number</label>
            <input
              required
              value={tailNumber}
              onChange={(e) => setTailNumber(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
              placeholder="N101AO"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Model</label>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
              placeholder="Boeing 737"
              list="aircraft-model-suggestions"
            />
            <datalist id="aircraft-model-suggestions">
              {AIRCRAFT_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Seat capacity</label>
            <input
              required
              type="number"
              min={1}
              value={seatCapacity}
              onChange={(e) => setSeatCapacity(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
            />
          </div>
          <button className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 rounded-lg">
            Save
          </button>
          {error && <p className="text-sm text-tuired-400 col-span-full">{error}</p>}
        </form>
      )}

      <div className="bg-accent border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-4 py-2">Tail #</th>
              <th className="px-4 py-2">Model</th>
              <th className="px-4 py-2">Seats</th>
              <th className="px-4 py-2">Status</th>
              {can(Permission.MANAGE_AIRCRAFT) && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleFleet.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 font-medium">{a.tailNumber}</td>
                <td className="px-4 py-2">{a.model}</td>
                <td className="px-4 py-2">{a.seatCapacity}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={a.status} />
                </td>
                {can(Permission.MANAGE_AIRCRAFT) && (
                  <td className="px-4 py-2 text-right">
                    {a.status !== "RETIRED" && (
                      <button onClick={() => retire(a)} className="text-tuired-400 hover:underline text-xs">
                        Retire
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visibleFleet.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  {fleet.length === 0 ? "No aircraft yet." : "No aircraft match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
