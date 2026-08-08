import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)]">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-primary)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }

  return children;
}
