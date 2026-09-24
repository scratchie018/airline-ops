import { Navigate } from "react-router-dom";
import { startDiscordLogin } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex items-center justify-center bg-bg">
      <div className="bg-accent rounded-xl shadow-lg shadow-black/30 border p-8 w-full max-w-sm text-center">
        <img src="icon.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-3 ring-1 ring-outline/30" />
        <h1 className="text-xl font-bold mb-1 text-ink">Airline Ops</h1>
        <p className="text-sm text-ink-muted mb-6">
          Sign in with the Discord account you use in our server - staff will assign your role from there.
        </p>
        <button
          onClick={() => startDiscordLogin()}
          className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <i className="fa-brands fa-discord" /> Sign in with Discord
        </button>
      </div>
    </div>
  );
}
