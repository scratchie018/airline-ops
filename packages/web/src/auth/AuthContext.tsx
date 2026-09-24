import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Membership, Permission, User, hasPermission } from "shared";
import { apiFetch, clearCurrentAirlineId, clearWebToken, getCurrentAirlineId, setCurrentAirlineId } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Every airline this account has a Membership in - empty until this loads,
   * even for a signed-in user, so check `loading` before treating [] as final. */
  memberships: Membership[];
  /** The Membership matching the currently-selected airline, or null if none is
   * selected yet (a brand new account with zero airlines, or one that hasn't
   * picked between several yet). */
  currentMembership: Membership | null;
  selectAirline: (airlineId: string) => void;
  can: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentAirlineId, setCurrentAirlineIdState] = useState<string | null>(getCurrentAirlineId());
  const [loading, setLoading] = useState(true);

  function selectAirline(airlineId: string) {
    setCurrentAirlineId(airlineId);
    setCurrentAirlineIdState(airlineId);
  }

  async function refresh() {
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);

      const mine = await apiFetch<Membership[]>("/airlines/mine");
      setMemberships(mine);

      // Auto-select: keep whatever's already chosen if it's still valid,
      // otherwise fall back to the only option when there's exactly one -
      // anything else (zero, or an unresolved choice among several) is left
      // for the airline picker screen to handle.
      const stillValid = mine.some((m) => m.airlineId === getCurrentAirlineId());
      if (!stillValid) {
        if (mine.length === 1) selectAirline(mine[0].airlineId);
        else clearCurrentAirlineId();
      }
      setCurrentAirlineIdState(getCurrentAirlineId());
    } catch {
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    clearWebToken();
    clearCurrentAirlineId();
    setCurrentAirlineIdState(null);
    setUser(null);
    setMemberships([]);
  }

  const currentMembership = useMemo(
    () => memberships.find((m) => m.airlineId === currentAirlineId) ?? null,
    [memberships, currentAirlineId]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        memberships,
        currentMembership,
        selectAirline,
        can: (permission) => (currentMembership ? hasPermission(currentMembership.role, permission) : false),
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
