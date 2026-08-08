import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ArrowLeft, Flame, BookOpen, MessageSquare, LogIn, Sparkles, Trophy, ArrowRight, ShieldCheck } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { toast } from "@/lib/toast";

const DAILY_REWARDS = { xp: 80, credits: 15 };
const WEEKLY_REWARDS = { xp: 200, credits: 40 };

export function DailyMissionsPage() {
  const navigate = useNavigate();
  const { wallet, completeDailyMission, completeWeeklyMission } = useRewards();
  const [busyDaily, setBusyDaily] = useState(false);
  const [busyWeekly, setBusyWeekly] = useState(false);

  const credits = wallet?.credits ?? 0;
  const xp = wallet?.xp ?? 0;
  const streak = wallet?.streak?.current ?? 0;

  const daily = wallet?.missions?.daily;
  const weekly = wallet?.missions?.weekly;

  const today = wallet?.today || {};
  const readingSec = Number(today.readingSec || 0);
  const postsCount = Number(today.post || 0);
  const commentsCount = Number(today.comment || 0);
  const loginDone = Boolean(daily?.objectives?.login || today.login);
  const readingDone = Boolean(daily?.objectives?.reading30 || readingSec >= 1800);
  const postDone = Boolean(daily?.objectives?.post || postsCount >= 1);
  const commentsDone = Boolean(daily?.objectives?.comments || commentsCount >= 1);

  const completedCount = [loginDone, readingDone, postDone, commentsDone].filter(Boolean).length;
  const canClaimDaily = Boolean(daily && !daily.done && loginDone && readingDone && postDone && commentsDone);

  const streakNeeded = weekly?.streakNeeded || 7;
  const canClaimWeekly = Boolean(weekly && !weekly.done && streak >= streakNeeded);

  async function handleClaimDaily() {
    if (busyDaily || !canClaimDaily) return;
    setBusyDaily(true);
    try {
      const raw = await completeDailyMission();
      if (raw?.missions?.daily?.done) {
        toast.success(`Missão diária concluída! +${DAILY_REWARDS.credits} créditos e +${DAILY_REWARDS.xp} XP adicionados.`);
      } else {
        toast.error("Nem todos os objetivos foram concluídos ainda.");
      }
    } catch (err) {
      toast.error(err?.message || "Erro ao resgatar a missão diária.");
    } finally {
      setBusyDaily(false);
    }
  }

  async function handleClaimWeekly() {
    if (busyWeekly || !canClaimWeekly) return;
    setBusyWeekly(true);
    try {
      const raw = await completeWeeklyMission();
      if (raw?.missions?.weekly?.done) {
        toast.success(`Missão semanal concluída! +${WEEKLY_REWARDS.credits} créditos e +${WEEKLY_REWARDS.xp} XP adicionados.`);
      } else {
        toast.error("Você precisa manter a sequência de dias para concluir a missão semanal.");
      }
    } catch (err) {
      toast.error(err?.message || "Erro ao resgatar a missão semanal.");
    } finally {
      setBusyWeekly(false);
    }
  }

  const objectives = [
    {
      id: "m-login",
      title: "Check-in Diário",
      desc: "Entre no aplicativo diariamente para registrar presença.",
      current: loginDone ? 1 : 0,
      total: 1,
      unit: "",
      done: loginDone,
      actionLabel: "Ir para o Início",
      actionLink: "/app/inicio",
      icon: LogIn,
    },
    {
      id: "m-read",
      title: "Ler 30 minutos no dia",
      desc: "Leia qualquer obra na Biblioteca por pelo menos 30 minutos acumulados.",
      current: readingDone ? 30 : Math.min(30, Math.floor(readingSec / 60)),
      total: 30,
      unit: "min",
      done: readingDone,
      actionLabel: "Abrir Biblioteca",
      actionLink: "/app/biblioteca",
      icon: BookOpen,
    },
    {
      id: "m-reflection",
      title: "Publicar 1 reflexão",
      desc: "Compartilhe uma ideia, citação ou post com a comunidade.",
      current: postDone ? 1 : Math.min(1, postsCount),
      total: 1,
      unit: "post",
      done: postDone,
      actionLabel: "Criar publicação",
      actionLink: "/app/inicio",
      icon: Sparkles,
    },
    {
      id: "m-comment",
      title: "Comentar 1 vez na comunidade",
      desc: "Participe ativamente comentando em uma publicação da comunidade.",
      current: commentsDone ? 1 : Math.min(1, commentsCount),
      total: 1,
      unit: "comentário",
      done: commentsDone,
      actionLabel: "Ver publicações",
      actionLink: "/app/inicio",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-6">
      {/* Navegação / Voltar */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/loja"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar para a Loja
        </Link>
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          Progresso sincronizado via servidor
        </span>
      </div>

      {/* Header Minimalista */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Central de Missões
        </h1>
        <p className="text-xs text-[var(--text-muted)] sm:text-sm">
          Cumpra objetivos diariamente para acumular créditos e resgatar produtos na Loja OPE.
        </p>
      </div>

      {/* Grid de Métricas Clean */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:border-[var(--border-hover)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Saldo em Créditos</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">{credits}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">disponíveis</p>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:border-[var(--border-hover)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Experiência Total</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-amber-500">{xp}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">XP acumulados</p>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:border-[var(--border-hover)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Ofensiva de Leitura</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Flame className="size-5 text-amber-500" />
            <span className="text-2xl font-black tracking-tight text-[var(--text-primary)]">{streak}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">dias seguidos</p>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:border-[var(--border-hover)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Objetivos Hoje</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">{completedCount}/4</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">concluídos</p>
        </div>
      </div>

      {/* Seção Missão Diária */}
      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-canvas)]/40 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Missões do Dia</h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <span>Recompensa total:</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-500 font-bold">+{DAILY_REWARDS.credits} créditos</span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-amber-500 font-bold">+{DAILY_REWARDS.xp} XP</span>
          </div>
        </div>

        {/* Lista de Objetivos */}
        <div className="divide-y divide-[var(--border)]/60">
          {objectives.map((item) => {
            const Icon = item.icon;
            const percentage = Math.min(100, Math.round((item.current / item.total) * 100));

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--hover-overlay)]/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] border ${
                    item.done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]"
                  }`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.done
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                          : "bg-[var(--bg-canvas)] text-[var(--text-muted)] border border-[var(--border)]"
                      }`}>
                        {item.done ? "Concluído" : `${item.current}/${item.total} ${item.unit}`}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    
                    {!item.done && (
                      <div className="pt-1.5 max-w-xs space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-canvas)] border border-[var(--border)]">
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-[var(--border)]/40 sm:border-0">
                  {item.done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-500">
                      <Check className="size-3.5" /> Cumprido
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(item.actionLink)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] hover:border-[var(--border-hover)] transition-all"
                    >
                      {item.actionLabel}
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resgate Global da Missão Diária */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--bg-canvas)]/60 px-5 py-4">
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {daily?.done
                ? "Recompensa diária resgatada com sucesso!"
                : canClaimDaily
                ? "Todos os 4 objetivos concluídos! Resgate sua recompensa."
                : `Faltam ${4 - completedCount} objetivo(s) para liberar os créditos do dia.`}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Conclua o check-in, leitura, publicação e comentário para pontuar.
            </p>
          </div>

          {daily?.done ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500">
              <Check className="size-4" /> Resgatado hoje
            </span>
          ) : (
            <button
              type="button"
              disabled={!canClaimDaily || busyDaily}
              onClick={handleClaimDaily}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-6 py-2.5 text-xs font-bold text-[var(--bg-card)] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {busyDaily ? "Resgatando..." : canClaimDaily ? `Resgatar +${DAILY_REWARDS.credits} Créditos` : "Complete os Objetivos"}
            </button>
          )}
        </div>
      </div>

      {/* Seção Missão Semanal */}
      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--bg-canvas)]/40 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Missão Semanal de Sequência</h2>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-500">
            +{WEEKLY_REWARDS.credits} créditos / +{WEEKLY_REWARDS.xp} XP
          </span>
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-amber-500/30 bg-amber-500/10 text-amber-500">
              <Flame className="size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Sequência de {streakNeeded} Dias Consecutivos</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Mantenha a ofensiva de leitura e interação por {streakNeeded} dias na semana para desbloquear o bônus semanal.
              </p>
              
              <div className="pt-2 max-w-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Progresso da Sequência</span>
                  <span className="font-bold text-[var(--text-primary)]">{streak} de {streakNeeded} dias ({Math.min(100, Math.round((streak / streakNeeded) * 100))}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-canvas)] border border-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (streak / streakNeeded) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end pt-3 sm:pt-0 border-t border-[var(--border)]/40 sm:border-0">
            {weekly?.done ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500">
                <Check className="size-4" /> Concluído esta semana
              </span>
            ) : (
              <button
                type="button"
                disabled={!canClaimWeekly || busyWeekly}
                onClick={handleClaimWeekly}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-6 py-2.5 text-xs font-bold text-[var(--bg-card)] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {busyWeekly ? "Resgatando..." : canClaimWeekly ? `Resgatar +${WEEKLY_REWARDS.credits} Créditos` : `${streak}/${streakNeeded} Dias`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
