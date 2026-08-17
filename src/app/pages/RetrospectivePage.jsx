import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadRetrospective } from "@/lib/retrospective-api";
import { RetrospectiveModal } from "../components/RetrospectiveModal";

export function RetrospectivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const kind = searchParams.get("period") === "year" ? "year" : "month";

  useEffect(() => {
    let active = true;
    loadRetrospective().then((snapshot) => {
      if (active) setData(snapshot);
    }).catch((cause) => {
      if (active) setError(cause?.message || "Nao foi possivel carregar sua retrospectiva.");
    });
    return () => { active = false; };
  }, []);

  if (error) return <div className="mx-auto mt-24 max-w-md px-5 text-center text-sm text-[var(--text-secondary)]">{error}</div>;
  if (!data) return <div className="mx-auto mt-24 max-w-md px-5 text-center text-sm text-[var(--text-secondary)]">Carregando sua retrospectiva...</div>;
  return <RetrospectiveModal data={data} initialKind={kind} open onClose={() => navigate("/app/inicio")} />;
}
