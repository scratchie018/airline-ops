import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { setWebToken } from "../api";
import { useAuth } from "../auth/AuthContext";

/** Lands here after Discord login completes - the server redirects here with
 * ?token=... (see server's routes/auth.ts), we stash it and bounce to the
 * dashboard. Explicitly calls refresh() rather than relying on AuthProvider's
 * own mount-time fetch to happen to run after this component's effect - that
 * ordering is real (children's effects fire before ancestors' on first mount)
 * but too implicit to depend on for something this easy to just do directly.
 * <Navigate replace> drops this URL - and the token that was briefly in it -
 * from browser history immediately once done. */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const token = params.get("token");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    setWebToken(token);
    refresh().then(() => setReady(true));
  }, [token]);

  if (!token) {
    return <p className="text-tuired-400 p-8">Login failed - no token received.</p>;
  }
  if (!ready) {
    return (
      <div className="min-h-full flex items-center justify-center bg-bg text-ink-muted">
        <i className="fa-solid fa-circle-notch fa-spin mr-2" /> Signing in...
      </div>
    );
  }
  return <Navigate to="/" replace />;
}
