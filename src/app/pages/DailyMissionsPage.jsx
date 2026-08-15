import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Flame,
  LogIn,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { toast } from "@/lib/toast";

const WEEKLY_REWARD = 40;

const FALLBACK_OBJECTIVES = [
  { key: "login", counter: "login", title: "Check-in diario", description: "Entre no OPE Club para registrar sua presenca." },
  { key: "reading30", counter: "reading_30min", title: "Ler 30 minutos", description: "Leia qualquer obra na Biblioteca por 30 minutos." },
  { key: "post", counter: "post", title: "Publicar uma reflexao", description: "Compartilhe uma ideia com a comunidade." },
  { key: "comment", counter: "comment", title: "Comentar uma vez", description: "Participe de uma publicacao da comunidade." },
];

const OBJECTIVE_ICONS = {
  login: LogIn,
  reading15: BookOpen,
  reading30: BookOpen,
  post: Sparkles,
  comment: MessageSquare,
};

function getObjectiveProgress(objective, today) {
  const counter = objective.counter || objective.key;
  const reading = Math.floor(Number(today.readingSec || 0) / 60);
  if (counter === "reading_30min") return { current: Math.min(30, reading), total: 30, unit: "min" };
  if (counter === "reading_15min") return { current: Math.min(15, reading), total: 15, unit: "min" };
  return { current: Math.min(1, Number(today[counter] || 0)), total: Number(objective.target || 1), unit: "vez" };
}

function objectiveLink(objective) {
  if (objective.counter?.startsWith("reading_")) return { link: "/app/biblioteca", action: "Abrir biblioteca" };
  if (objective.counter === "post" || objective.counter === "comment") return { link: "/app/inicio", action: "Ir para comunidade" };
  return { link: "/app/inicio", action: "Ir para o inicio" };
}

export function DailyMissionsPage() {
  const { wallet, completeDailyMission, completeWeeklyMission } = useRewards();
  const [busyDaily, setBusyDaily] = useState(false);
  const [busyWeekly, setBusyWeekly] = useState(false);
  const credits = wallet?.credits ?? 0;
  const streak = wallet?.streak?.current ?? 0;
  const daily = wallet?.missions?.daily;
  const weekly = wallet?.missions?.weekly;
  const today = wallet?.today || {};
  const definition = daily?.definition;
  const dailyReward = Number(definition?.reward || 15);
  const objectives = useMemo(() => {
    const source = Array.isArray(definition?.objectives) && definition.objectives.length > 0
      ? definition.objectives
      : FALLBACK_OBJECTIVES;
    return source.map((objective) => {
      const progress = getObjectiveProgress(objective, today);
      return {
        ...objective,
        ...progress,
        done: progress.current >= progress.total,
        ...objectiveLink(objective),
        icon: OBJECTIVE_ICONS[objective.key] || Sparkles,
      };
    });
  }, [definition, today]);
  const completedCount = objectives.filter((item) => item.done).length;
  const canClaimDaily = Boolean(daily && !daily.done && completedCount === objectives.length);
  const streakNeeded = weekly?.streakNeeded || 7;
  const canClaimWeekly = Boolean(weekly && !weekly.done && streak >= streakNeeded);

  async function claimDaily() {
    if (busyDaily || !canClaimDaily) return;
    setBusyDaily(true);
    try {
      const raw = await completeDailyMission();
      if (raw?.missions?.daily?.done) toast.success(`Missao concluida! Recompensa base: +${dailyReward} creditos.`);
      else toast.error("Nem todos os objetivos foram concluidos ainda.");
    } catch (err) {
      toast.error(err?.message || "Erro ao resgatar a missao diaria.");
    } finally {
      setBusyDaily(false);
    }
  }

  async function claimWeekly() {
    if (busyWeekly || !canClaimWeekly) return;
    setBusyWeekly(true);
    try {
      const raw = await completeWeeklyMission();
      if (raw?.missions?.weekly?.done) toast.success(`Missao semanal concluida! +${WEEKLY_REWARD} creditos adicionados.`);
      else toast.error("Voce precisa manter a sequencia para concluir a missao semanal.");
    } catch (err) {
      toast.error(err?.message || "Erro ao resgatar a missao semanal.");
    } finally {
      setBusyWeekly(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/inicio" className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-4" /> Voltar para a comunidade
        </Link>
        <span className="text-[11px] text-[var(--text-muted)]">Novos objetivos a cada dia · progresso protegido pelo servidor</span>
      </div>

      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">OPE Club</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Missoes diarias</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">Pequenas praticas de leitura e conversa que viram creditos para a Loja.</p>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            {definition?.tier === "pensador" ? "Trilha Pensador" : "Trilha Leitor"}
          </div>
        </div>
        {definition?.title && <p className="mt-4 text-xs font-semibold text-emerald-500">Trilha de hoje: {definition.title}</p>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Saldo</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{credits}</p>
          <p className="text-[11px] text-[var(--text-muted)]">creditos</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sequencia</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-black text-[var(--text-primary)]"><Flame className="size-5 text-amber-500" /> {streak}</p>
          <p className="text-[11px] text-[var(--text-muted)]">dias seguidos</p>
        </div>
        <div className="col-span-2 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Objetivos hoje</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{completedCount}/{objectives.length}</p>
          <p className="text-[11px] text-[var(--text-muted)]">concluidos</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--bg-canvas)]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-500" /><h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Objetivos do dia</h2></div>
          <span className="text-xs font-semibold text-emerald-500">Recompensa base: +{dailyReward} creditos</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {objectives.map((item) => {
            const Icon = item.icon;
            const percent = Math.min(100, Math.round((item.current / item.total) * 100));
            return (
              <div key={item.key} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] border ${item.done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-muted)]"}`}><Icon className="size-5" /></div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--hover-overlay)]"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} /></div>
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{item.current}/{item.total} {item.unit}</span>
                    </div>
                  </div>
                </div>
                <Link to={item.link} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]">
                  {item.done ? <Check className="size-4" /> : item.action}
                </Link>
              </div>
            );
          })}
        </div>
        <div className="border-t border-[var(--border)] p-5">
          <button type="button" disabled={!canClaimDaily || busyDaily} onClick={claimDaily} className="min-h-11 w-full rounded-[9px] bg-[var(--text-primary)] py-2.5 text-sm font-semibold text-[var(--bg-card)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
            {daily?.done ? "Missao concluida hoje" : canClaimDaily ? "Resgatar creditos" : "Conclua os objetivos para resgatar"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-canvas)]/40 px-5 py-4"><div className="flex items-center gap-2"><Trophy className="size-4 text-amber-500" /><h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Missao semanal</h2></div><span className="text-xs font-semibold text-amber-500">+{WEEKLY_REWARD} creditos</span></div>
        <div className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Mantenha uma sequencia de {streakNeeded} dias lendo ou participando da comunidade.</p>
          <button type="button" disabled={!canClaimWeekly || busyWeekly} onClick={claimWeekly} className="mt-4 min-h-11 w-full rounded-[9px] border border-[var(--border)] py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:cursor-not-allowed disabled:opacity-40">
            {weekly?.done ? "Missao concluida nesta semana" : canClaimWeekly ? "Resgatar creditos" : `${streak}/${streakNeeded} dias`}
          </button>
        </div>
      </section>
    </div>
  );
}
