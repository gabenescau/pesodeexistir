import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";

// Diferente do SubscriptionGuard, o AdminGuard so exige ser admin — nao exige
// assinatura ativa. Admins que gerenciam a plataforma nao precisam pagar para
// acessar o painel. Um nao-admin e redirecionado para o início (RLS ja barra
// qualquer mutacao no banco, entao isto e defesa em profundidade na UI).
export function AdminGuard({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="size-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/entrar" replace />;
  if (!isAdmin) return <Navigate to="/app/inicio" replace />;

  return children;
}
