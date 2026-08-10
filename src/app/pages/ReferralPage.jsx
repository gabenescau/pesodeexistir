import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users, Copy, WhatsappLogo, Check, Gift, Trophy, Loader2 } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { useRewards } from "@/app/data/RewardsContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";

// Recompensas reais: +500 XP / +100 creditos por amigo que vira assinante
// ativo ha 30+ dias (mesmo valor da ReferralWidget e do RPC referral_claim).
const REFERRAL_REWARD = { xp: 500, credits: 100 };

function StatusBadge({ status }) {
  const isConfirmed = status === "confirmed";
  const isPending = status === "pending";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isConfirmed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : isPending
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
      }`}
    >
      {isConfirmed ? "Confirmado" : isPending ? "Em validação" : status}
    </span>
  );
}

export function ReferralPage() {
  const { getMyReferralCode, referralClaim, refresh } = useRewards();
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    if (!isSupabaseReady()) {
      if (import.meta.env.PROD) setLoadError("O servico de indicacoes esta temporariamente indisponivel.");
      setLoading(false);
      return;
    }
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const [codeResult, referralsResult] = await Promise.allSettled([
      getMyReferralCode(),
      supabase
        .from("referrals")
        .select("referred_user_id, rewarded_at, created_at")
        .eq("referrer_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (codeResult.status === "rejected" || referralsResult.status === "rejected") {
      setLoadError("Nao foi possivel carregar suas indicacoes. Tente novamente.");
    }
    if (codeResult.status === "fulfilled") setCode(codeResult.value || "");
    const rows = referralsResult.status === "fulfilled" ? (referralsResult.value?.data || []) : [];
    setReferrals(rows);

    const referredIds = rows.map((r) => r.referred_user_id).filter(Boolean);
    if (referredIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase.rpc("list_public_profiles", {
        p_ids: referredIds,
      });
      if (profilesError) {
        setLoadError("Indicacoes carregadas, mas os perfis nao puderam ser atualizados.");
      }
      setProfilesMap((profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
    } else {
      setProfilesMap({});
    }
    setLoading(false);
  }, [getMyReferralCode]);

  useEffect(() => {
    load().catch((error) => {
      console.warn("Falha ao carregar indicacoes:", error?.message || error);
      setLoadError("Nao foi possivel carregar suas indicacoes. Tente novamente.");
      setLoading(false);
    });
  }, [load]);

  const link = code ? `${window.location.origin}/entrar?ref=${code}` : "";
  const confirmed = referrals.filter((r) => r.rewarded_at).length;
  const pendingCount = referrals.filter((r) => !r.rewarded_at).length;

  const handleCopyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Link de indicação copiado!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Nao foi possivel copiar o link. Tente novamente."));
  };

  const handleShareWhatsApp = () => {
    if (!link) return;
    const msg = encodeURIComponent(
      `Oi! Estou te indicando para o OPE Club. Use meu link para se cadastrar: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  async function claim(referredUserId) {
    if (busy) return;
    setBusy(referredUserId);
    try {
      await referralClaim(referredUserId);
      toast.success(`Recompensa de indicação creditada! +${REFERRAL_REWARD.xp} XP, +${REFERRAL_REWARD.credits} créditos.`);
      await refresh();
      await load();
    } catch (err) {
      toast.error(err?.message || "Este convidado ainda não completou 30 dias de assinatura ativa.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-6">

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-[12px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => load()} className="min-h-10 rounded-[9px] border border-amber-400/40 px-3 font-medium hover:bg-amber-400/10">
            Tentar novamente
          </button>
        </div>
      )}

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
          Programa de Indicações
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Indique amigos para o OPE Club e acumule XP e créditos a cada assinatura confirmada.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total de Indicados</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{referrals.length}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">amigos no total</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confirmadas</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{confirmed}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">assinaturas ativas há 30+ dias</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Créditos Ganhos</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">+{confirmed * REFERRAL_REWARD.credits}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">100 créditos por indicação confirmada</p>
        </div>
      </div>

      {/* Hero Card — Código & Compartilhamento */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Seu Código de Indicação
            </span>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-wider">
              {code || "——"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!link}
              className="flex items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!link}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-[var(--text-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <WhatsappLogo className="size-4" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Caixinha do Link */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3.5 py-2.5">
          <p className="text-xs text-[var(--text-muted)] font-mono break-all selection:bg-[var(--hover-overlay)]">
            {link || "Entre no OPE Club para gerar seu link."}
          </p>
        </div>

        {/* Recompensas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sua Recompensa</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">
              +{REFERRAL_REWARD.xp} XP e +{REFERRAL_REWARD.credits} Créditos
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">por amigo que assinar e ficar 30 dias ativo</p>
          </div>
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Como funciona</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">Validação automática</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">a recompensa libera quando a assinatura do convidado completa 30 dias</p>
          </div>
        </div>
      </div>

      {/* Lista de Amigos Indicados */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Amigos Indicados ({referrals.length})
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Carregando suas indicações...</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {referrals.map((ref) => {
              const friend = profilesMap[ref.referred_user_id];
              const isPending = !ref.rewarded_at;
              return (
                <div key={ref.referred_user_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--hover-overlay)] transition-colors">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border)]">
                        {(friend?.avatar?.startsWith("http") || friend?.avatar_url?.startsWith("http"))
                          ? <img src={friend.avatar || friend.avatar_url} alt="" className="size-full rounded-full object-cover" />
                          : (friend?.name?.charAt(0) || "C")}
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {friend?.name || "Convidado"}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] pl-10">
                      @{friend ? handleDoPerfil(friend) : "membro"} · {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0">
                    {isPending ? (
                      <button
                        type="button"
                        disabled={busy === ref.referred_user_id}
                        onClick={() => claim(ref.referred_user_id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors disabled:opacity-50"
                      >
                        {busy === ref.referred_user_id ? <Loader2 className="size-3.5 animate-spin" /> : <Gift className="size-3.5" />}
                        {busy === ref.referred_user_id ? "Validando..." : "Reclamar recompensa"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <Check className="size-3.5" /> Recompensado
                      </span>
                    )}
                    <StatusBadge status={ref.rewarded_at ? "confirmed" : "pending"} />
                  </div>
                </div>
              );
            })}

            {referrals.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Users className="size-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-muted)]">Nenhuma indicação realizada ainda. Compartilhe seu link acima!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de progresso da recompensa */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 flex items-start gap-3">
        <Trophy className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {pendingCount > 0
              ? `${pendingCount} indicação(ões) aguardando validação`
              : confirmed > 0
              ? "Todas as suas indicações foram recompensadas!"
              : "Comece indicando seu primeiro amigo"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            A validação acontece automaticamente quando o convidado mantém a assinatura ativa por 30 dias.
          </p>
        </div>
      </div>

    </div>
  );
}
