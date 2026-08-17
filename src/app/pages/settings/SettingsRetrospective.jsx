import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, BookOpen, ChartLine, ChatCircle, Clock, Lock } from "@/lib/icons";
import { SettingsLayout, SettingsSection } from "../../components/SettingsLayout";
import { RetrospectiveModal } from "../../components/RetrospectiveModal";
import { loadRetrospective } from "@/lib/retrospective-api";
import { DEMO_RETROSPECTIVE } from "@/lib/retrospective-demo";

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

export function SettingsRetrospective() {
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [kind, setKind] = useState("month");
  const [shareOpen, setShareOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadRetrospective()
      .then((snapshot) => { if (active) setData(snapshot); })
      .catch((cause) => { if (active) setError(cause?.message || "Nao foi possivel carregar sua retrospectiva."); });
    return () => { active = false; };
  }, []);

  const viewData = demoMode ? DEMO_RETROSPECTIVE : data;
  const snapshot = viewData?.[kind] || null;
  const allowed = demoMode || viewData?.allowed !== false;

  return (
    <SettingsLayout title="Retrospectiva" subtitle="Sua jornada de leitura no OPE Club" onBack={() => setSearchParams({})}>
      <SettingsSection icon={ChartLine} label="Sua jornada">
        {error && !demoMode ? <div className="flex flex-col items-center gap-3 p-8 text-center"><p className="text-sm text-[var(--text-secondary)]">{error}</p><button type="button" onClick={() => { setError(""); setDemoMode(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]">Ver exemplo</button></div> : !data && !demoMode ? <p className="p-5 text-sm text-[var(--text-secondary)]">Carregando sua retrospectiva...</p> : !allowed ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]"><Lock className="size-5" /></div>
            <div><p className="font-medium text-[var(--text-primary)]">Beneficio dos planos OPE Club</p><p className="mt-1 text-xs text-[var(--text-muted)]">Assine um plano para acompanhar e compartilhar sua retrospectiva.</p></div>
            <div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => navigate("/app/planos")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-xs font-semibold text-[var(--bg-card)]"><ArrowUpRight className="size-4" /> Ver planos</button><button type="button" onClick={() => setDemoMode(true)} className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]">Ver exemplo</button></div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 border-b border-[var(--border)] p-4 sm:px-5">
              {["month", "year"].map((option) => (
                <button key={option} type="button" onClick={() => setKind(option)} className={`min-h-10 rounded-full px-4 text-xs font-semibold ${kind === option ? "bg-[var(--text-primary)] text-[var(--bg-card)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"}`}>
                  {option === "month" ? "Mensal" : "Anual"}
                </button>
              ))}
              <button type="button" onClick={() => setDemoMode((value) => !value)} className={`ml-auto min-h-10 rounded-full border px-3 text-[11px] font-semibold ${demoMode ? "border-[var(--accent-mint)] text-[var(--accent-mint)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{demoMode ? "Voltar aos meus dados" : "Ver exemplo"}</button>
            </div>
            <div className="p-4 sm:p-5">
              {demoMode ? <p className="mb-3 rounded-xl border border-[var(--accent-mint)]/40 bg-[var(--accent-mint)]/5 px-3 py-2 text-xs text-[var(--text-secondary)]">Pre-visualizacao com dados ficticios. Nada aqui altera sua conta.</p> : null}
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-mint)]">{snapshot?.label || (kind === "month" ? "Ultimo mes" : "Ultimo ano")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Tudo o que voce viveu na leitura</h2>
              {snapshot?.hasData ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] p-3"><Clock className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{formatMinutes(snapshot.minutes)}</strong><span className="text-[10px] text-[var(--text-muted)]">de leitura</span></div>
                    <div className="rounded-2xl border border-[var(--border)] p-3"><BookOpen className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.booksStarted || 0}</strong><span className="text-[10px] text-[var(--text-muted)]">livros iniciados</span></div>
                    <div className="rounded-2xl border border-[var(--border)] p-3"><ChatCircle className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.comments || 0}</strong><span className="text-[10px] text-[var(--text-muted)]">comentarios</span></div>
                    <div className="rounded-2xl border border-[var(--border)] p-3"><ChartLine className="mb-2 size-4 text-[var(--accent-mint)]" /><strong className="block text-[var(--text-primary)]">{snapshot.posts || 0}</strong><span className="text-[10px] text-[var(--text-muted)]">posts publicados</span></div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--text-secondary)]">Sua leitura mais marcante foi <strong className="text-[var(--text-primary)]">{snapshot.topBook?.title || "uma descoberta especial"}</strong>{snapshot.topAuthor?.name ? `, de ${snapshot.topAuthor.name}` : ""}.</p>
                </>
              ) : <p className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--text-muted)]">Ainda nao ha atividade suficiente neste periodo. Continue lendo e participando da comunidade.</p>}
              <button type="button" disabled={!snapshot?.hasData} onClick={() => setShareOpen(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--text-primary)] px-4 text-xs font-semibold text-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-50"><ArrowUpRight className="size-4" /> Abrir e compartilhar</button>
            </div>
          </>
        )}
      </SettingsSection>
      <RetrospectiveModal data={viewData} initialKind={kind} open={shareOpen} onClose={() => setShareOpen(false)} />
    </SettingsLayout>
  );
}
