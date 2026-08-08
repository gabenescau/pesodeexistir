import { useState } from "react";
import { CheckCircle2, Flame, Target, Trophy } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { DAILY_CAPS } from "@/lib/rewards";
import { toast } from "@/lib/toast";

const DAILY_MISSION_REWARDS = { xp: 80, credits: 15 };
const WEEKLY_MISSION_REWARDS = { xp: 200, credits: 40 };

function ClaimButton({ disabled, onClick, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-full bg-[var(--accent-mint)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// Widget de missoes diaria/semanal. O progresso vem do wallet_state (RPC),
// a conclusao so acontece no servidor (complete_daily_mission/complete_weekly_mission).
export function MissionsWidget() {
  const { wallet, completeDailyMission, completeWeeklyMission } = useRewards();
  const [busyDaily, setBusyDaily] = useState(false);
  const [busyWeekly, setBusyWeekly] = useState(false);

  const daily = wallet?.missions?.daily;
  const weekly = wallet?.missions?.weekly;
  const canClaimDaily = Boolean(daily && !daily.done && daily.objectives.login && daily.objectives.reading30 && daily.objectives.post && daily.objectives.comments);
  const canClaimWeekly = Boolean(weekly && !weekly.done && (wallet?.streak?.current ?? 0) >= (weekly.streakNeeded || 7));

  async function claimDaily() {
    if (busyDaily) return;
    setBusyDaily(true);
    try {
      const raw = await completeDailyMission();
      if (raw?.missions?.daily?.done) {
        toast.success(`Missão diária concluída! +${DAILY_MISSION_REWARDS.xp} XP, +${DAILY_MISSION_REWARDS.credits} créditos.`);
      } else {
        toast.error("Nem todos os objetivos da missão diária foram cumpridos ainda.");
      }
    } catch (err) {
      toast.error(err?.message || "Não foi possível concluir a missão diária.");
    } finally {
      setBusyDaily(false);
    }
  }

  async function claimWeekly() {
    if (busyWeekly) return;
    setBusyWeekly(true);
    try {
      const raw = await completeWeeklyMission();
      if (raw?.missions?.weekly?.done) {
        toast.success(`Missão semanal concluída! +${WEEKLY_MISSION_REWARDS.xp} XP, +${WEEKLY_MISSION_REWARDS.credits} créditos.`);
      } else {
        toast.error(`Ainda faltam dias de sequência. Continue lendo diariamente!`);
      }
    } catch (err) {
      toast.error(err?.message || "Não foi possível concluir a missão semanal.");
    } finally {
      setBusyWeekly(false);
    }
  }

  if (!wallet) return null;

  const streak = wallet.streak?.current || 0;
  const objectiveItems = [
    { key: "login", label: "Entrar na plataforma" },
    { key: "reading30", label: "Ler 30 min no dia" },
    { key: "post", label: "Publicar 1 discussão" },
    { key: "comments", label: "Comentar 1 vez" },
  ];

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Missões
        </h3>
        <span className="flex items-center gap-1 rounded-full bg-[var(--hover-overlay)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
          <Flame className="size-3.5 text-[var(--accent-mint)]" />
          {streak} {streak === 1 ? "dia" : "dias"}
        </span>
      </div>

      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Target className="size-4 text-[var(--accent-mint)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Missão diária</p>
          {daily?.done && <CheckCircle2 className="ml-auto size-4 text-[var(--accent-mint)]" />}
        </div>
        <ul className="mb-3 space-y-1.5">
          {objectiveItems.map((item) => {
            const done = Boolean(daily?.objectives?.[item.key]);
            return (
              <li key={item.key} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className={`size-3.5 shrink-0 ${done ? "text-[var(--accent-mint)]" : "text-[var(--text-muted)]"}`} />
                <span className={`${done ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{item.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Recompensa: +{DAILY_MISSION_REWARDS.xp} XP, +{DAILY_MISSION_REWARDS.credits} créditos
        </p>
        {daily?.done ? (
          <p className="text-center text-xs font-medium text-[var(--accent-mint)]">Concluída hoje ✓</p>
        ) : (
          <ClaimButton disabled={!canClaimDaily || busyDaily} onClick={claimDaily} label={canClaimDaily ? "Concluir missão diária" : "Missão em andamento"} />
        )}
      </div>

      <div className="mt-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="size-4 text-[var(--accent-mint)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Missão semanal</p>
          {weekly?.done && <CheckCircle2 className="ml-auto size-4 text-[var(--accent-mint)]" />}
        </div>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          Mantenha uma sequência de {weekly?.streakNeeded || 7} dias lendo ou participando da comunidade.
        </p>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Recompensa: +{WEEKLY_MISSION_REWARDS.xp} XP, +{WEEKLY_MISSION_REWARDS.credits} créditos
        </p>
        {weekly?.done ? (
          <p className="text-center text-xs font-medium text-[var(--accent-mint)]">Concluída esta semana ✓</p>
        ) : (
          <ClaimButton disabled={!canClaimWeekly || busyWeekly} onClick={claimWeekly} label={canClaimWeekly ? "Concluir missão semanal" : `${streak}/${weekly?.streakNeeded || 7} dias`} />
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Atividade diária é limitada a {DAILY_CAPS.xp} XP e {DAILY_CAPS.credits} créditos por dia. Missões não contam para o limite.
      </p>
    </div>
  );
}
