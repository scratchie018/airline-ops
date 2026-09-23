import { FormEvent, useEffect, useState } from "react";
import { AuditLogEntry, Paginated, Role, RoleMapping, User } from "shared";
import { apiFetch } from "../api";

type Tab = "users" | "mappings" | "audit";

const ROLE_OPTIONS = [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT, Role.PASSENGER];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1"><i className="fa-solid fa-user-shield text-brand-400 mr-2" />Admin</h1>
      <p className="text-ink-muted mb-4">Owner-only: manage staff access and review recent activity.</p>

      <div className="flex gap-1 mb-4 border-b">
        {(["users", "mappings", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-brand-500 text-brand-300" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t === "users" ? "Users" : t === "mappings" ? "Discord Role Mapping" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "mappings" && <MappingsTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setUsers(await apiFetch<User[]>("/users"));
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(id: string, role: Role) {
    setError(null);
    try {
      await apiFetch(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-accent border rounded-xl overflow-hidden">
      <div className="px-4 pt-3 text-xs text-ink-muted">
        Overrides here take effect immediately, but get replaced the next time that person logs in via
        Discord (their role re-resolves from Discord Role Mapping below) - use it for quick fixes, not
        permanent assignment.
      </div>
      {error && <p className="text-sm text-tuired-400 px-4 pt-2">{error}</p>}
      <table className="w-full text-sm mt-2">
        <thead className="bg-bg text-ink-muted text-left">
          <tr>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Current role</th>
            <th className="px-4 py-2">Set role</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2 flex items-center gap-2">
                {u.discordAvatarUrl && <img src={u.discordAvatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                {u.discordUsername}
              </td>
              <td className="px-4 py-2">{u.role.replace("_", " ")}</td>
              <td className="px-4 py-2">
                <select
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value as Role)}
                  className="border rounded-lg px-2 py-1 text-sm bg-bg text-ink"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MappingsTab() {
  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [discordRoleId, setDiscordRoleId] = useState("");
  const [appRole, setAppRole] = useState<Role>(Role.PILOT);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setMappings(await apiFetch<RoleMapping[]>("/admin/role-mappings"));
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/role-mappings", {
        method: "POST",
        body: JSON.stringify({ discordRoleId, appRole, label: label || undefined }),
      });
      setDiscordRoleId("");
      setLabel("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this mapping? Anyone with that Discord role will fall back to Passenger on next login.")) return;
    await apiFetch(`/admin/role-mappings/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <p className="text-sm text-ink-muted mb-3">
        Controls what app role someone gets based on which role they hold in your Discord server - configured
        here instead of server env vars, so it takes effect immediately with no restart. Right-click a role
        in Discord (Developer Mode on) → Copy Role ID.
      </p>

      <form onSubmit={onCreate} className="bg-accent border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs text-ink-muted mb-1">Discord Role ID</label>
          <input
            required
            value={discordRoleId}
            onChange={(e) => setDiscordRoleId(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
            placeholder="123456789012345678"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">App role</label>
          <select value={appRole} onChange={(e) => setAppRole(e.target.value as Role)} className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted">
            {[Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT].map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Label (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
            placeholder="Senior Pilot"
          />
        </div>
        <button className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 rounded-lg">
          <i className="fa-solid fa-plus mr-1.5" />
          Add mapping
        </button>
        {error && <p className="text-sm text-tuired-400 col-span-full">{error}</p>}
      </form>

      <div className="bg-accent border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-4 py-2">Discord Role ID</th>
              <th className="px-4 py-2">App role</th>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-mono text-xs">{m.discordRoleId}</td>
                <td className="px-4 py-2">{m.appRole.replace("_", " ")}</td>
                <td className="px-4 py-2 text-ink-muted">{m.label || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(m.id)} className="text-tuired-400 hover:underline text-xs">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No mappings configured yet - falling back to the server's env var configuration.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    apiFetch<Paginated<AuditLogEntry>>("/admin/audit-log?pageSize=100").then((r) => setEntries(r.items));
  }, []);

  return (
    <div className="bg-accent border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg text-ink-muted text-left">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Who</th>
            <th className="px-4 py-2">Action</th>
            <th className="px-4 py-2">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2 text-ink-muted whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2">{e.actor?.discordUsername ?? "—"}</td>
              <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
              <td className="px-4 py-2 text-ink-muted">{e.detail ?? "—"}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                No activity recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
