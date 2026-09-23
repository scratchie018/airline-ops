import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Permission } from "shared";
import { useAuth } from "../auth/AuthContext";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-outline/10 hover:text-ink"
  }`;

function AirlineSwitcher() {
  const { memberships, currentMembership, selectAirline } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!currentMembership) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-ink bg-bg/60 hover:bg-bg border transition-colors"
      >
        <i className="fa-solid fa-building" /> {currentMembership.airline.name}
        {memberships.length > 1 && <i className="fa-solid fa-chevron-down text-xs text-ink-muted" />}
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-56 rounded-md border bg-accent shadow-lg shadow-black/30 z-10 overflow-hidden">
          {memberships.map((m) => (
            <button
              key={m.airlineId}
              onClick={() => {
                selectAirline(m.airlineId);
                navigate("/");
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-outline/10 flex items-center justify-between ${
                m.airlineId === currentMembership.airlineId ? "text-brand-400" : "text-ink"
              }`}
            >
              {m.airline.name}
              {m.airlineId === currentMembership.airlineId && <i className="fa-solid fa-check" />}
            </button>
          ))}
          <button
            onClick={() => navigate("/airlines")}
            className="w-full text-left px-3 py-2 text-sm text-ink-muted hover:bg-outline/10 border-t"
          >
            <i className="fa-solid fa-plus mr-1" /> Manage airlines
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, currentMembership, can, logout } = useAuth();

  return (
    <div className="min-h-full">
      <header className="border-b bg-accent">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src="logo-wordmark.png" alt="Airline Ops" className="h-7" />
            <AirlineSwitcher />
            <nav className="flex gap-1">
              <NavLink to="/" end className={navItemClass}>
                <i className="fa-solid fa-gauge" /> Dashboard
              </NavLink>
              <NavLink to="/flights" className={navItemClass}>
                <i className="fa-solid fa-plane" /> Flights
              </NavLink>
              {can(Permission.MANAGE_AIRCRAFT) && (
                <NavLink to="/aircraft" className={navItemClass}>
                  <i className="fa-solid fa-warehouse" /> Fleet
                </NavLink>
              )}
              <NavLink to="/my-bookings" className={navItemClass}>
                <i className="fa-solid fa-ticket" /> My Bookings
              </NavLink>
              {can(Permission.MANAGE_USER_ROLES) && (
                <NavLink to="/admin" className={navItemClass}>
                  <i className="fa-solid fa-user-shield" /> Admin
                </NavLink>
              )}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              {user.discordAvatarUrl && (
                <img src={user.discordAvatarUrl} alt="" className="w-7 h-7 rounded-full ring-1 ring-outline/30" />
              )}
              <div className="text-sm">
                <div className="font-medium text-ink">{user.discordUsername}</div>
                {currentMembership && (
                  <div className="text-xs text-ink-muted">{currentMembership.role.replace("_", " ")}</div>
                )}
              </div>
              <button
                onClick={() => logout()}
                className="text-sm text-ink-muted hover:text-tuired-400 ml-2 transition-colors"
                title="Sign out"
              >
                <i className="fa-solid fa-right-from-bracket" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
