import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireAirline from "./components/RequireAirline";
import AdminPage from "./pages/AdminPage";
import AircraftPage from "./pages/AircraftPage";
import AirlinesPage from "./pages/AirlinesPage";
import AuthCallback from "./pages/AuthCallback";
import BriefingPage from "./pages/BriefingPage";
import Dashboard from "./pages/Dashboard";
import FlightDetailPage from "./pages/FlightDetailPage";
import FlightsPage from "./pages/FlightsPage";
import Login from "./pages/Login";
import MyBookingsPage from "./pages/MyBookingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/airlines" element={<AirlinesPage />} />
        <Route element={<RequireAirline />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/flights" element={<FlightsPage />} />
            <Route path="/flights/:id" element={<FlightDetailPage />} />
            <Route path="/aircraft" element={<AircraftPage />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />
            <Route path="/briefing" element={<BriefingPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
