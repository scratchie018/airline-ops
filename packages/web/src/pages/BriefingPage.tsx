import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BRIEFING_CHARTS, Brief } from "shared";
import { apiFetch } from "../api";
import { useToast } from "../components/Toast";

type Tab = "briefer" | "scope" | "charts";

const FIELD_ORDER = [
  "squawk",
  "flightLevel",
  "initialClimb",
  "departureIcao",
  "arrivalIcao",
  "waypoints",
  "departureRunway",
  "departureTaxiInfo",
  "arrivalRunway",
  "arrivalTaxiInfo",
  "atis",
  "notam",
] as const satisfies readonly (keyof Brief)[];

const EMPTY_BRIEF: Record<(typeof FIELD_ORDER)[number], string> = {
  squawk: "",
  flightLevel: "",
  initialClimb: "",
  departureIcao: "",
  arrivalIcao: "",
  waypoints: "",
  departureRunway: "",
  departureTaxiInfo: "",
  arrivalRunway: "",
  arrivalTaxiInfo: "",
  atis: "",
  notam: "",
};

/** Everything on this page is styled to feel like the standalone 24Brief tool
 * it was ported from (near-black background, blue accent) rather than
 * blending into AirlineOps' own purple theme - deliberately a distinct,
 * recognizable "tool" area within the app. */
export default function BriefingPage() {
  const [tab, setTab] = useState<Tab>("briefer");
  const [fields, setFields] = useState(EMPTY_BRIEF);

  return (
    <div className="-m-4 sm:-m-6 rounded-xl overflow-hidden" style={{ background: "#0b0b0c", color: "white" }}>
      <div className="flex gap-1 p-3 border-b border-white/10">
        {(["briefer", "scope", "charts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{ background: tab === t ? "#3b82f6" : "#1a1a1c", color: "white" }}
          >
            {t === "briefer" ? "Briefer" : t === "scope" ? "Scope" : "Charts"}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "briefer" && <BrieferTab fields={fields} setFields={setFields} />}
        {tab === "scope" && <ScopeTab />}
        {tab === "charts" && <ChartsTab fields={fields} />}
      </div>
    </div>
  );
}

const briefInputClass =
  "w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-1";
const briefInputStyle = { background: "#1a1a1c", border: "1px solid #2f2f2f" };

function BrieferTab({
  fields,
  setFields,
}: {
  fields: Record<(typeof FIELD_ORDER)[number], string>;
  setFields: (f: Record<(typeof FIELD_ORDER)[number], string>) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Brief>("/briefer").then((brief) => {
      setFields({
        squawk: brief.squawk,
        flightLevel: brief.flightLevel,
        initialClimb: brief.initialClimb,
        departureIcao: brief.departureIcao,
        arrivalIcao: brief.arrivalIcao,
        waypoints: brief.waypoints,
        departureRunway: brief.departureRunway,
        departureTaxiInfo: brief.departureTaxiInfo,
        arrivalRunway: brief.arrivalRunway,
        arrivalTaxiInfo: brief.arrivalTaxiInfo,
        atis: brief.atis,
        notam: brief.notam,
      });
      setLoading(false);
    });
  }, []);

  function set(key: (typeof FIELD_ORDER)[number], value: string) {
    setFields({ ...fields, [key]: value });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/briefer", { method: "PUT", body: JSON.stringify(fields) });
      toast.success("Brief saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-white/60">Loading...</p>;

  return (
    <form onSubmit={save} className="max-w-xl mx-auto space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Flight Data</h3>
        <input className={briefInputClass} style={briefInputStyle} placeholder="Squawk" value={fields.squawk} onChange={(e) => set("squawk", e.target.value)} />
        <input className={briefInputClass} style={briefInputStyle} placeholder="Flight Level" value={fields.flightLevel} onChange={(e) => set("flightLevel", e.target.value)} />
        <input className={briefInputClass} style={briefInputStyle} placeholder="Initial Climb" value={fields.initialClimb} onChange={(e) => set("initialClimb", e.target.value)} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Route</h3>
        <input className={briefInputClass} style={briefInputStyle} placeholder="Departure Airport (ICAO)" value={fields.departureIcao} onChange={(e) => set("departureIcao", e.target.value)} />
        <input className={briefInputClass} style={briefInputStyle} placeholder="Arrival Airport (ICAO)" value={fields.arrivalIcao} onChange={(e) => set("arrivalIcao", e.target.value)} />
        <textarea className={briefInputClass} style={briefInputStyle} placeholder="Waypoints" rows={2} value={fields.waypoints} onChange={(e) => set("waypoints", e.target.value)} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Departure</h3>
        <input className={briefInputClass} style={briefInputStyle} placeholder="Departure Runway" value={fields.departureRunway} onChange={(e) => set("departureRunway", e.target.value)} />
        <textarea className={briefInputClass} style={briefInputStyle} placeholder="Departure Taxi Info" rows={2} value={fields.departureTaxiInfo} onChange={(e) => set("departureTaxiInfo", e.target.value)} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Arrival</h3>
        <input className={briefInputClass} style={briefInputStyle} placeholder="Arrival Runway" value={fields.arrivalRunway} onChange={(e) => set("arrivalRunway", e.target.value)} />
        <textarea className={briefInputClass} style={briefInputStyle} placeholder="Arrival Taxi Info" rows={2} value={fields.arrivalTaxiInfo} onChange={(e) => set("arrivalTaxiInfo", e.target.value)} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">Briefing</h3>
        <textarea className={briefInputClass} style={briefInputStyle} placeholder="ATIS" rows={3} value={fields.atis} onChange={(e) => set("atis", e.target.value)} />
        <textarea className={briefInputClass} style={briefInputStyle} placeholder="NOTAM" rows={3} value={fields.notam} onChange={(e) => set("notam", e.target.value)} />
      </section>

      <button
        disabled={saving}
        className="w-full py-2.5 rounded-lg font-medium text-white disabled:opacity-60"
        style={{ background: "#3b82f6" }}
      >
        {saving ? "Saving..." : "Save Brief"}
      </button>
    </form>
  );
}

function ScopeTab() {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <p className="text-white/70 mb-6">
        24Scope can't be embedded here directly - its site blocks being shown inside another page (a security
        setting on their end, not something on our side). It opens cleanly in your browser instead.
      </p>
      <a
        href="https://zedruc.net/24scope/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-5 py-2.5 rounded-lg font-medium text-white"
        style={{ background: "#3b82f6" }}
      >
        Open 24Scope ↗
      </a>
    </div>
  );
}

function ChartsTab({ fields }: { fields: Record<(typeof FIELD_ORDER)[number], string> }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const visible = useMemo(
    () => BRIEFING_CHARTS.filter((c) => c.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  function fit() {
    setTransform({ scale: 1, x: 0, y: 0 });
  }
  function center() {
    setTransform((t) => ({ ...t, x: 0, y: 0 }));
  }
  function zoomIn() {
    setTransform((t) => ({ ...t, scale: t.scale * 1.25 }));
  }
  function zoomOut() {
    setTransform((t) => ({ ...t, scale: t.scale * 0.8 }));
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setTransform((t) => ({ ...t, scale: t.scale * (e.deltaY < 0 ? 1.25 : 0.8) }));
  }
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    setTransform((t) => ({ ...t, x: dragging.current!.origX + dx, y: dragging.current!.origY + dy }));
  }
  function onMouseUp() {
    dragging.current = null;
  }

  return (
    <div className="flex gap-4" style={{ height: "60vh" }}>
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search charts..."
          className={briefInputClass}
          style={briefInputStyle}
        />
        <div className="flex-1 overflow-y-auto rounded-lg" style={{ background: "#111113" }}>
          {visible.map((c) => (
            <button
              key={c}
              onClick={() => {
                setSelected(c);
                fit();
              }}
              className="w-full text-left px-3 py-2 text-sm"
              style={{ background: selected === c ? "#3b82f6" : "transparent" }}
            >
              {c}
            </button>
          ))}
          {visible.length === 0 && <p className="text-white/40 text-sm px-3 py-2">No charts match.</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex gap-2">
          <button onClick={center} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#3b82f6" }}>
            🎯 Center
          </button>
          <button onClick={zoomIn} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#3b82f6" }}>
            +
          </button>
          <button onClick={zoomOut} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#3b82f6" }}>
            -
          </button>
          <button onClick={fit} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "#3b82f6" }}>
            ⤢ Fit
          </button>
        </div>
        <div
          className="flex-1 rounded-lg overflow-hidden relative select-none"
          style={{ background: "#111113", cursor: selected ? "grab" : "default" }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {selected ? (
            <>
              <img
                src={`/charts/${selected}.png`}
                alt={selected}
                draggable={false}
                className="absolute top-1/2 left-1/2 max-w-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  maxHeight: "100%",
                }}
              />
              <div
                className="absolute top-2.5 left-2.5 rounded-lg px-2.5 py-2 text-xs whitespace-pre-line max-w-xs"
                style={{ background: "rgba(0,0,0,0.7)" }}
              >
                {`Chart: ${selected}\n\nDEP TAXI:\n${fields.departureTaxiInfo || "—"}\n\nARR TAXI:\n${
                  fields.arrivalTaxiInfo || "—"
                }`}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-sm">
              Select a chart from the list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
