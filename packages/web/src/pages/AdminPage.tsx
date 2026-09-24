import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuditLogEntry, Paginated, Permission, Role, RoleMapping, User } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

type Tab = "users" | "mappings" | "audit";

const ROLE_OPTIONS = [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT, Role.PASSENGER];

export default function AdminPage() {
  const { can } = useAuth();
  const canManageUsers = can(Permission.MANAGE_USER_ROLES);
  const canManageMappings = can(Permission.MANAGE_ROLE_MAPPINGS);
  const tabs: Tab[] = [
    ...(canManageUsers ? (["users"] as Tab[]) : []),
    ...(canManageMappings ? (["mappings"] as Tab[]) : []),
    ...(canManageUsers ? (["audit"] as Tab[]) : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1"><i className="fa-solid fa-user-shield text-brand-400 mr-2" />Admin</h1>
      <p className="text-ink-muted mb-4">
        {canManageUsers ? "Owner: manage staff access and review recent activity." : "Manage Discord role mapping."}
      </p>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map((t) => (
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

      {tab === "users" && canManageUsers && <UsersTab />}
      {tab === "mappings" && canManageMappings && <MappingsTab />}
      {tab === "audit" && canManageUsers && <AuditTab />}
    </div>
  );
}

type MemberUser = User & { role: Role; roleLocked: boolean };

function UsersTab() {
  const toast = useToast();
  const [users, setUsers] = useState<MemberUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setUsers(await apiFetch<MemberUser[]>("/users"));
  }

  useEffect(() => {
    load();
  }, []);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.discordUsername.toLowerCase().includes(q));
  }, [users, search]);

  async function setRole(id: string, role: Role) {
    setError(null);
    try {
      await apiFetch(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      toast.success("Role updated");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function unlockRole(id: string) {
    setError(null);
    try {
      await apiFetch(`/users/${id}/role/unlock`, { method: "POST" });
      toast.success("Role unlocked - will resync from Discord");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Locks a role in place without changing it - the dropdown only locks when
  // you pick a *different* role, so this is how you lock someone who's
  // already at the role you want (e.g. a Discord-synced Passenger you don't
  // want demoted/promoted if their Discord roles change later).
  async function lockRole(id: string, currentRole: Role) {
    await setRole(id, currentRole);
  }

  return (
    <div className="bg-accent border rounded-xl overflow-hidden">
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Setting a role here is permanent - it locks that person's role so Discord sync won't overwrite it
          on their next login. Click "Unlock" to hand a role back to Discord Role Mapping below.
        </p>
        <div className="relative shrink-0 w-44">
          <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted text-xs" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full border rounded-lg pl-7 pr-2 py-1 text-xs bg-bg text-ink placeholder:text-ink-muted"
          />
        </div>
      </div>
      {error && <p className="text-sm text-tuired-400 px-4 pt-2">{error}</p>}
      <table className="w-full text-sm mt-2">
        <thead className="bg-bg text-ink-muted text-left">
          <tr>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Current role</th>
            <th className="px-4 py-2">Set role (permanent)</th>
            <th className="px-4 py-2">Lock</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {visibleUsers.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2 flex items-center gap-2">
                {u.discordAvatarUrl && <img src={u.discordAvatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                {u.discordUsername}
              </td>
              <td className="px-4 py-2">
                {u.role.replace("_", " ")}
                {u.roleLocked && (
                  <i className="fa-solid fa-lock text-ink-muted ml-1.5 text-xs" title="Locked - won't be changed by Discord sync" />
                )}
              </td>
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
              <td className="px-4 py-2">
                {u.roleLocked ? (
                  <button onClick={() => unlockRole(u.id)} className="text-xs text-brand-300 hover:text-brand-200 hover:underline whitespace-nowrap">
                    <i className="fa-solid fa-lock-open mr-1" /> Unlock
                  </button>
                ) : (
                  <button
                    onClick={() => lockRole(u.id, u.role)}
                    className="text-xs text-ink-muted hover:text-ink hover:underline whitespace-nowrap"
                  >
                    <i className="fa-solid fa-lock mr-1" /> Lock
                  </button>
                )}
              </td>
            </tr>
          ))}
          {visibleUsers.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                {users.length === 0 ? "No users yet." : "No users match your search."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MappingsTab() {
  const { currentMembership } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isOwner = currentMembership?.role === Role.OWNER;
  const assignableRoles = isOwner
    ? [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT]
    : [Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT];

  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [discordRoleId, setDiscordRoleId] = useState("");
  const [appRole, setAppRole] = useState<Role>(Role.PILOT);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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
      toast.success("Mapping added");
      setDiscordRoleId("");
      setLabel("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      message: "Remove this mapping? Anyone with that Discord role will fall back to Passenger on next login.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await apiFetch(`/admin/role-mappings/${id}`, { method: "DELETE" });
    toast.success("Mapping removed");
    load();
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiFetch<{ membersScanned: number; usersCreated: number; membershipsCreated: number; membershipsUpdated: number }>(
        "/admin/sync-roles",
        { method: "POST" }
      );
      setSyncResult(
        `Scanned ${result.membersScanned} server members - ${result.usersCreated} new, ${result.membershipsCreated} joined, ${result.membershipsUpdated} role changes.`
      );
    } catch (err: any) {
      setSyncResult(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-sm text-ink-muted">
          Controls what app role someone gets based on which role they hold in your Discord server - configured
          here instead of server env vars, so it takes effect immediately with no restart. Right-click a role
          in Discord (Developer Mode on) → Copy Role ID.
        </p>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="shrink-0 bg-accent border hover:bg-outline/10 disabled:opacity-60 text-ink text-xs font-medium py-1.5 px-3 rounded-lg whitespace-nowrap"
        >
          {syncing ? <i className="fa-solid fa-circle-notch fa-spin mr-1.5" /> : <i className="fa-solid fa-rotate mr-1.5" />}
          Sync Discord roles now
        </button>
      </div>
      {syncResult && <p className="text-xs text-ink-muted mb-3">{syncResult}</p>}

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
            {assignableRoles.map((r) => (
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
                  No mappings configured yet - everyone who isn't the Owner defaults to Passenger.
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
