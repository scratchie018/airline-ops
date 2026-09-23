import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/** Gates everything that needs an active airline (the whole app besides the
 * airline picker/creator itself) - runs after ProtectedRoute has already
 * confirmed the user is signed in. */
export default function RequireAirline() {
  const { loading, currentMembership } = useAuth();

  if (loading) return null;
  if (!currentMembership) return <Navigate to="/airlines" replace />;
  return <Outlet />;
}
