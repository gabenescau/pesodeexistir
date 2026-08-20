import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadRetrospective } from "@/lib/retrospective-api";
import { RetrospectiveModal } from "../components/RetrospectiveModal";

export function RetrospectivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const period = searchParams.get("period");
  const kind = period === "year" ? "year" : period === "previousMonth" ? "previousMonth" : "month";

  useEffect(() => {
    let active = true;
    const refresh = () => loadRetrospective().then((snapshot) => {
      if (active) setData(snapshot);
    }).catch((cause) => {
      if (active) setError(cause?.message || "Nao foi possivel carregar sua retrospectiva.");
    });
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (error) return <div className="mx-auto mt-24 max-w-md px-5 text-center text-sm text-[var(--text-secondary)]">{error}</div>;
  if (!data) return <div className="mx-auto mt-24 max-w-md px-5 text-center text-sm text-[var(--text-secondary)]">Carregando sua retrospectiva...</div>;
  if (data.allowed !== true) {
    return (
      <div className="mx-auto mt-24 max-w-md px-5 text-center">
        <p className="text-lg font-semibold text-[var(--text-primary)]">Retrospectiva exclusiva para assinantes</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Assine um plano OPE Club para acompanhar e compartilhar sua jornada de leitura.</p>
        <button
          type="button"
          onClick={() => navigate("/app/planos")}
          className="mt-5 min-h-11 rounded-full bg-[var(--text-primary)] px-5 text-sm font-semibold text-[var(--bg-card)]"
        >
          Ver planos
        </button>
      </div>
    );
  }
  return <RetrospectiveModal data={data} initialKind={kind} open onClose={() => navigate("/app/inicio")} />;
}
