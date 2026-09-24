import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Membership, Role } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";

function EditAirlineForm({ membership, onDone }: { membership: Membership; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(membership.airline.name);
  const [discordGuildId, setDiscordGuildId] = useState(membership.airline.discordGuildId);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(membership.airline.discordWebhookUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/airlines/${membership.airlineId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, discordGuildId, discordWebhookUrl }),
      });
      toast.success("Airline updated");
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-4 py-3 bg-bg/40 space-y-3">
      <div>
        <label className="block text-xs text-ink-muted mb-1">Airline name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-1.5 text-sm bg-bg text-ink"
        />
      </div>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Discord Server ID</label>
        <input
          required
          value={discordGuildId}
          onChange={(e) => setDiscordGuildId(e.target.value)}
          className="w-full border rounded-lg px-3 py-1.5 text-sm bg-bg text-ink font-mono"
        />
        <p className="text-xs text-ink-muted mt-1">Changing this re-grabs the icon from the new server (not the name - edit that above if you want it to match).</p>
      </div>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Discord announcements webhook (optional)</label>
        <input
          value={discordWebhookUrl}
          onChange={(e) => setDiscordWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="w-full border rounded-lg px-3 py-1.5 text-sm bg-bg text-ink font-mono placeholder:text-ink-muted"
        />
        <p className="text-xs text-ink-muted mt-1">
          Posts flight scheduling, status, and cancellation updates to a channel automatically. Channel Settings →
          Integrations → Webhooks → New Webhook → Copy URL. Leave blank to turn announcements off.
        </p>
      </div>
      {error && <p className="text-sm text-tuired-400">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={submitting}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium py-1.5 px-3 rounded-lg"
        >
          {submitting && <i className="fa-solid fa-circle-notch fa-spin mr-1.5" />}
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-ink-muted hover:text-ink py-1.5 px-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type GuildCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "found"; name: string; iconUrl: string | null }
  | { status: "not-found" };

function CreateAirlineForm({ onCreated }: { onCreated: (airlineId: string) => void }) {
  const toast = useToast();
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [check, setCheck] = useState<GuildCheck>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Debounced live check as the Owner types a guild ID - the bot has to
  // actually be in that server before "Create airline" ever becomes
  // clickable, and this doubles as where the name/icon preview comes from.
  useEffect(() => {
    const id = discordGuildId.trim();
    if (!id) {
      setCheck({ status: "idle" });
      return;
    }
    setCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<{ present: boolean; name?: string; iconUrl?: string | null }>(
          `/airlines/check-guild/${encodeURIComponent(id)}`
        );
        setCheck(result.present ? { status: "found", name: result.name!, iconUrl: result.iconUrl ?? null } : { status: "not-found" });
      } catch {
        setCheck({ status: "not-found" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [discordGuildId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (check.status !== "found") return;
    setError(null);
    setSubmitting(true);
    try {
      const airline = await apiFetch<{ id: string }>("/airlines", {
        method: "POST",
        body: JSON.stringify({ discordGuildId: discordGuildId.trim() }),
      });
      toast.success(`${check.name} created - you're the Owner`);
      onCreated(airline.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onCreate} className="bg-accent border rounded-xl p-5 space-y-4">
      <p className="text-sm text-ink-muted">
        Invite the Airline Ops bot to your Discord server first, then register it here - you'll become its
        Owner. The airline's name and icon come straight from the server, no need to type them in.
      </p>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Discord Server ID</label>
        <input
          required
          value={discordGuildId}
          onChange={(e) => setDiscordGuildId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-bg text-ink placeholder:text-ink-muted font-mono"
          placeholder="123456789012345678"
        />
        <p className="text-xs text-ink-muted mt-1">
          Server Settings → Widget → Server ID (enable Developer Mode to right-click and copy it directly).
        </p>
      </div>

      {check.status === "checking" && (
        <p className="text-sm text-ink-muted"><i className="fa-solid fa-circle-notch fa-spin mr-1.5" />Checking for the bot...</p>
      )}
      {check.status === "found" && (
        <div className="flex items-center gap-3 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 rounded-lg px-3 py-2">
          {check.iconUrl ? (
            <img src={check.iconUrl} alt="" className="w-8 h-8 rounded-lg" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/30 flex items-center justify-center">
              <i className="fa-solid fa-building" />
            </div>
          )}
          <span className="text-sm">
            <i className="fa-solid fa-circle-check mr-1.5" />
            Found <strong>{check.name}</strong>
          </span>
        </div>
      )}
      {check.status === "not-found" && (
        <p className="text-sm text-tuired-400">
          <i className="fa-solid fa-circle-exclamation mr-1.5" />
          The bot isn't in that server (or the ID's wrong) - invite it first, then try again.
        </p>
      )}

      {error && <p className="text-sm text-tuired-400">{error}</p>}
      <button
        disabled={check.status !== "found" || submitting}
        className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg"
      >
        {submitting ? <i className="fa-solid fa-circle-notch fa-spin mr-1.5" /> : <i className="fa-solid fa-plus mr-1.5" />}
        Create airline
      </button>
    </form>
  );
}

export default function AirlinesPage() {
  const { user, memberships, selectAirline, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [editingAirlineId, setEditingAirlineId] = useState<string | null>(null);

  function pick(airlineId: string) {
    selectAirline(airlineId);
    navigate("/");
  }

  async function onCreated(airlineId: string) {
    await refresh();
    pick(airlineId);
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="icon.png" alt="" className="w-10 h-10 rounded-xl ring-1 ring-outline/30" />
            <h1 className="text-xl font-bold text-ink">Airline Ops</h1>
          </div>
          {user && (
            <button onClick={() => logout()} className="text-sm text-ink-muted hover:text-ink">
              <i className="fa-solid fa-right-from-bracket mr-1" /> Sign out
            </button>
          )}
        </div>

        {memberships.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Your airlines</h2>
            <div className="bg-accent border rounded-xl divide-y overflow-hidden">
              {memberships.map((m) =>
                editingAirlineId === m.airlineId ? (
                  <EditAirlineForm
                    key={m.airlineId}
                    membership={m}
                    onDone={() => {
                      setEditingAirlineId(null);
                      refresh();
                    }}
                  />
                ) : (
                  <div key={m.airlineId} className="w-full flex items-center justify-between px-4 py-3 hover:bg-outline/10 transition-colors">
                    <button onClick={() => pick(m.airlineId)} className="flex-1 flex items-center gap-3 text-left">
                      {m.airline.iconUrl ? (
                        <img src={m.airline.iconUrl} alt="" className="w-8 h-8 rounded-lg shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0 text-ink-muted">
                          <i className="fa-solid fa-building" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-ink">{m.airline.name}</div>
                        <div className="text-xs text-ink-muted">{m.role.replace("_", " ")}</div>
                      </div>
                    </button>
                    {m.role === Role.OWNER && (
                      <button
                        onClick={() => setEditingAirlineId(m.airlineId)}
                        className="text-ink-muted hover:text-ink px-2"
                        title="Edit airline"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                    )}
                    <button onClick={() => pick(m.airlineId)} className="text-ink-muted px-1">
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Create a new airline</h2>
          <CreateAirlineForm onCreated={onCreated} />
        </div>
      </div>
    </div>
  );
}
