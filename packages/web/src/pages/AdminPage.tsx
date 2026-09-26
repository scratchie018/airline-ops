import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuditLogEntry, Paginated, Permission, Role, User } from "shared";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

type Tab = "users" | "roles" | "audit";

const ROLE_OPTIONS = [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT, Role.PASSENGER];

export default function AdminPage() {
  const { can } = useAuth();
  const canManageUsers = can(Permission.MANAGE_USER_ROLES);
  const canManageMappings = can(Permission.MANAGE_ROLE_MAPPINGS);
  const tabs: Tab[] = [
    ...(canManageUsers ? (["users"] as Tab[]) : []),
    ...(canManageMappings ? (["roles"] as Tab[]) : []),
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
            {t === "users" ? "Users" : t === "roles" ? "Roles" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "users" && canManageUsers && <UsersTab />}
      {tab === "roles" && canManageMappings && <RolesTab />}
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
  useAutoRefresh(load);

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
      toast.success("Role unlocked");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Locks a role in place without changing it - the dropdown only locks when
  // you pick a *different* role, so this is how you lock someone who's
  // already at the role you want.
  async function lockRole(id: string, currentRole: Role) {
    await setRole(id, currentRole);
  }

  return (
    <div className="bg-accent border rounded-xl overflow-hidden">
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Roles are set here or from the Roles tab - nothing changes anyone's role automatically. "Lock" is just
          a reminder marker for you; unlocking doesn't trigger anything on its own.
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
            <th className="px-4 py-2">Set role</th>
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
                {u.roleLocked && <i className="fa-solid fa-lock text-ink-muted ml-1.5 text-xs" title="Locked" />}
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

interface DiscordRoleRow {
  id: string;
  name: string;
  color: number;
  mapping: { id: string; appRole: Role; label: string | null } | null;
}

function roleColorHex(color: number): string {
  return color === 0 ? "#8f93c9" : `#${color.toString(16).padStart(6, "0")}`;
}

function RolesTab() {
  const { currentMembership } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isOwner = currentMembership?.role === Role.OWNER;
  const assignableRoles = isOwner
    ? [Role.OWNER, Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT]
    : [Role.MANAGER, Role.FLIGHT_HOST, Role.PILOT];

  const [roles, setRoles] = useState<DiscordRoleRow[]>([]);
  const [botCanManageRoles, setBotCanManageRoles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleClass, setNewRoleClass] = useState<Role>(Role.PILOT);
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await apiFetch<{ botCanManageRoles: boolean; roles: DiscordRoleRow[] }>("/admin/discord-roles");
      setRoles(data.roles);
      setBotCanManageRoles(data.botCanManageRoles);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useAutoRefresh(load);

  async function setClass(role: DiscordRoleRow, appRole: Role) {
    try {
      await apiFetch("/admin/discord-roles/mapping", {
        method: "PUT",
        body: JSON.stringify({ discordRoleId: role.id, discordRoleName: role.name, appRole }),
      });
      toast.success(`${role.name} -> ${appRole.replace("_", " ")}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function unsetClass(role: DiscordRoleRow) {
    const ok = await confirm({ message: `Stop treating "${role.name}" as a class?`, confirmLabel: "Unset", danger: true });
    if (!ok) return;
    await apiFetch(`/admin/discord-roles/mapping/${role.id}`, { method: "DELETE" });
    toast.success(`${role.name} unset`);
    load();
  }

  async function createRole(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch("/admin/discord-roles", {
        method: "POST",
        body: JSON.stringify({ name: newRoleName, appRole: newRoleClass }),
      });
      toast.success(`Created "${newRoleName}" in Discord`);
      setNewRoleName("");
      setShowNewRole(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-ink-muted">Loading roles...</p>;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-sm text-ink-muted">
          Every role in your Discord server, live. Set one as a class below - it's just a label here in the app
          until you assign it to someone in the Users tab; nothing changes automatically.
        </p>
        <button
          onClick={() => setShowNewRole((s) => !s)}
          disabled={!botCanManageRoles}
          title={botCanManageRoles ? undefined : "The bot needs the Manage Roles permission in your Discord server first"}
          className="shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-500 text-white text-xs font-medium py-1.5 px-3 rounded-lg whitespace-nowrap"
        >
          <i className={`fa-solid ${showNewRole ? "fa-xmark" : "fa-plus"} mr-1.5`} />
          New role
        </button>
      </div>
      {!botCanManageRoles && (
        <p className="text-xs text-ink-muted mb-3">
          <i className="fa-solid fa-circle-info mr-1" />
          The bot can't create roles in your server yet - give its role the "Manage Roles" permission in Discord to
          enable the button above.
        </p>
      )}
      {error && <p className="text-sm text-tuired-400 mb-3">{error}</p>}

      {showNewRole && (
        <form onSubmit={createRole} className="bg-accent border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-ink-muted mb-1">New Discord role name</label>
            <input
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink placeholder:text-ink-muted"
              placeholder="Pilot"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Class</label>
            <select
              value={newRoleClass}
              onChange={(e) => setNewRoleClass(e.target.value as Role)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-bg text-ink"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <button disabled={creating} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium py-1.5 rounded-lg">
            {creating && <i className="fa-solid fa-circle-notch fa-spin mr-1.5" />}
            Create in Discord
          </button>
        </form>
      )}

      <div className="bg-accent border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg text-ink-muted text-left">
            <tr>
              <th className="px-4 py-2">Discord role</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: roleColorHex(r.color) }} />
                  {r.name}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.mapping?.appRole ?? ""}
                    onChange={(e) => (e.target.value ? setClass(r, e.target.value as Role) : unsetClass(r))}
                    className="border rounded-lg px-2 py-1 text-sm bg-bg text-ink"
                  >
                    <option value="">— not a class —</option>
                    {assignableRoles.map((cr) => (
                      <option key={cr} value={cr}>
                        {cr.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2" />
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                  This server has no roles besides @everyone yet.
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

  function load() {
    apiFetch<Paginated<AuditLogEntry>>("/admin/audit-log?pageSize=100").then((r) => setEntries(r.items));
  }

  useEffect(load, []);
  useAutoRefresh(load);

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
