import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";

export function FollowButton({ userId, className = "" }) {
  const { user } = useAuth();
  const { isFollowing, followUser, unfollowUser } = useData();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  if (!userId || userId === user?.id) return null;

  const seguindo = isFollowing(userId);

  async function alternar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      if (seguindo) await unfollowUser(userId);
      else await followUser(userId);
    } catch (err) {
      setErro(err?.message || "Não foi possível atualizar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={ocupado}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
          seguindo
            ? "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            : "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
        } ${className}`}
      >
        {seguindo ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
        {seguindo ? "Seguindo" : "Seguir"}
      </button>
      {erro && <span className="text-[10px] text-red-400">{erro}</span>}
    </div>
  );
}
