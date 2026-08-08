import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowLeft, Flame, BookOpen, MessageSquare, LogIn, Sparkles } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { toast } from "@/lib/toast";

const DAILY_MISSIONS_CONFIG = [
  {
    id: "m-login",
    title: "Entrar no aplicativo",
    desc: "Faça login diariamente para garantir seu crédito.",
    reward: 1,
    current: 0,
    total: 1,
    icon: LogIn,
  },
  {
    id: "m-read",
    title: "Ler 30 minutos",
    desc: "Leia por pelo menos 30 minutos qualquer obra da Biblioteca.",
    reward: 3,
    current: 0,
    total: 1,
    icon: BookOpen,
  },
  {
    id: "m-reflection",
    title: "Publicar 1 reflexão",
    desc: "Compartilhe uma reflexão ou citação na comunidade.",
    reward: 1,
    current: 0,
    total: 1,
    icon: Sparkles,
  },
  {
    id: "m-comment",
    title: "Comentar em 2 publicações",
    desc: "Participe com comentários em duas publicações ativas da comunidade.",
    reward: 1,
    current: 0,
    total: 2,
    icon: MessageSquare,
  },
];

const BONUS_MISSION = {
  id: "m-bonus",
  title: "Bônus por concluir as 4 missões",
  desc: "Complete todas as missões diárias e ganhe um bônus extra.",
  reward: 2,
};

const WEEKLY_MISSION = {
  id: "w-1",
  title: "Missão Semanal",
  desc: "Conclua todas as missões diárias durante 5 dias na mesma semana.",
  reward: 20,
  daysCompleted: 3,
  daysRequired: 5,
};

export function DailyMissionsPage() {
  const { wallet, refresh } = useRewards();
  const credits = wallet?.credits ?? 0;
  const streak = wallet?.streakDays ?? 5;

  const [missions, setMissions] = useState(
    DAILY_MISSIONS_CONFIG.map((m) => ({ ...m, completed: false }))
  );
  const [bonusClaimed, setBonusClaimed] = useState(false);

  const completedCount = missions.filter((m) => m.completed).length;
  const allDailyDone = completedCount === missions.length;
  const availableToday = missions.filter((m) => !m.completed).reduce((s, m) => s + m.reward, 0) + (!bonusClaimed ? BONUS_MISSION.reward : 0);

  const handleClaimMission = (missionId, reward) => {
    setMissions((prev) => prev.map((m) => (m.id === missionId ? { ...m, completed: true, current: m.total } : m)));
    toast.success(`+${reward} crédito${reward > 1 ? "s" : ""} adicionado${reward > 1 ? "s" : ""}.`);
    refresh().catch(() => {});
  };

  const handleClaimBonus = () => {
    if (bonusClaimed) return;
    setBonusClaimed(true);
    toast.success(`+${BONUS_MISSION.reward} créditos de bônus adicionados.`);
    refresh().catch(() => {});
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-6">

      {/* Voltar */}
      <Link
        to="/app/loja"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar para a Loja
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          Missões Diárias
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Acumule créditos diariamente e troque por produtos exclusivos na Loja OPE.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Saldo Atual</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{credits}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">créditos</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Ofensiva</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{streak}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">dias seguidos</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-medium">Concluídas</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{completedCount}/{missions.length}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">missões hoje</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-medium">Disponível</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">+{availableToday}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">créditos em aberto</p>
        </div>
      </div>

      {/* Ofensiva Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
            <Flame className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Ofensiva de Leitura</p>
            <p className="text-xs text-[var(--text-muted)]">{streak} dias seguidos. Mantenha seu ritmo diário!</p>
          </div>
        </div>
        <div className="pl-13 sm:pl-0 text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Progresso Semanal</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">{WEEKLY_MISSION.daysCompleted} de {WEEKLY_MISSION.daysRequired} dias</p>
        </div>
      </div>

      {/* Missões Diárias */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Missões do Dia</p>
          <span className="text-xs font-semibold text-[var(--text-muted)]">+8 créditos/dia</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {missions.map((mission) => {
            const Icon = mission.icon;
            return (
              <div
                key={mission.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4 hover:bg-[var(--hover-overlay)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{mission.title}</p>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {mission.completed ? mission.total : mission.current}/{mission.total}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{mission.desc}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pl-12 sm:pl-0">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    +{mission.reward} cr.
                  </span>
                  {mission.completed ? (
                    <span className="flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                      <Check className="size-3.5" /> Concluído
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClaimMission(mission.id, mission.reward)}
                      className="rounded-[8px] bg-[var(--text-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
                    >
                      Resgatar
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bônus */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4 bg-[var(--hover-overlay)]/50">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{BONUS_MISSION.title}</p>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Bônus
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{BONUS_MISSION.desc}</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 pl-12 sm:pl-0">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                +{BONUS_MISSION.reward} cr.
              </span>
              {bonusClaimed ? (
                <span className="flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <Check className="size-3.5" /> Concluído
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!allDailyDone}
                  onClick={handleClaimBonus}
                  className="rounded-[8px] bg-[var(--text-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {allDailyDone ? "Resgatar Bônus" : "Bloqueado"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">Total diário (4 missões + bônus)</p>
          <p className="text-xs font-bold text-[var(--text-primary)]">+8 créditos</p>
        </div>
      </div>

      {/* Missão Semanal */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Missão Semanal</p>
        </div>

        <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
              <Flame className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{WEEKLY_MISSION.title}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{WEEKLY_MISSION.desc}</p>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{WEEKLY_MISSION.daysCompleted} de {WEEKLY_MISSION.daysRequired} dias</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {Math.round((WEEKLY_MISSION.daysCompleted / WEEKLY_MISSION.daysRequired) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full sm:w-56 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--text-primary)] transition-all"
                    style={{ width: `${(WEEKLY_MISSION.daysCompleted / WEEKLY_MISSION.daysRequired) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="pl-12 sm:pl-0 shrink-0 text-left sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Recompensa</p>
            <p className="mt-0.5 text-2xl font-bold text-[var(--text-primary)]">+{WEEKLY_MISSION.reward}</p>
            <p className="text-xs text-[var(--text-muted)]">créditos</p>
          </div>
        </div>
      </div>

    </div>
  );
}

