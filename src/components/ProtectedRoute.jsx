import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-[var(--text-primary)]">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl font-bold tracking-wider text-[var(--text-primary)]">OPE <span className="text-[var(--accent-mint)] font-light">CLUB</span></span>
          <div className="size-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent-mint)]" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }

  return children;
}
