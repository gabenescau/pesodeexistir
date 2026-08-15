import { useCallback, useEffect, useState } from "react";
import { Copy, UserPlus } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { toast } from "@/lib/toast";

export function ReferralWidget() {
  const { getMyReferralCode, referralClaim, refresh } = useRewards();
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return;
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return;
    const [codeResult, referralsResult] = await Promise.allSettled([
      getMyReferralCode(),
      supabase.from("referrals").select("referred_user_id, rewarded_at, created_at").eq("referrer_user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (codeResult.status === "fulfilled") setCode(codeResult.value || "");
    if (referralsResult.status === "fulfilled") setReferrals(referralsResult.value?.data || []);
  }, [getMyReferralCode]);

  useEffect(() => { load(); }, [load]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Codigo de indicacao copiado!");
    } catch { toast.error("Nao foi possivel copiar o codigo."); }
  }

  async function claim(referredUserId) {
    if (busy) return;
    setBusy(referredUserId);
    try {
      await referralClaim(referredUserId);
      toast.success("Recompensa de indicacao creditada! +100 creditos.");
      await refresh();
      await load();
    } catch (err) {
      toast.error(err?.message || "Este convidado ainda nao possui uma assinatura ativa.");
    } finally { setBusy(""); }
  }

  const pendingCount = referrals.filter((item) => !item.rewarded_at).length;

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="mb-3 flex items-center gap-2"><UserPlus className="size-4 text-[var(--accent-mint)]" /><h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Indique amigos</h3></div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">Cada amigo que assinar com seu codigo e ficar ativo rende <span className="font-semibold text-[var(--text-primary)]">+100 creditos</span>.</p>
      {code && <button type="button" onClick={copyCode} className="mb-3 flex w-full items-center justify-between gap-2 rounded-[8px] bg-[var(--hover-overlay)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-card-hover)]"><span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{code}</span><Copy className="size-4 shrink-0 text-[var(--text-muted)]" /></button>}
      {referrals.length > 0 && <div className="space-y-2"><p className="text-xs text-[var(--text-muted)]">{pendingCount > 0 ? `${pendingCount} convite(s) aguardando recompensa` : "Nenhum convite pendente."}</p>{referrals.slice(0, 5).map((item) => <div key={item.referred_user_id} className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--bg-canvas)] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs text-[var(--text-secondary)]">{item.rewarded_at ? "Recompensa recebida" : "Convidado"}</p><p className="text-[10px] text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div>{!item.rewarded_at && <button type="button" disabled={busy === item.referred_user_id} onClick={() => claim(item.referred_user_id)} className="shrink-0 rounded-full bg-[var(--accent-mint)] px-3 py-1.5 text-[11px] font-semibold text-[var(--bg-card)] transition-opacity disabled:opacity-50">{busy === item.referred_user_id ? "..." : "Reclamar"}</button>}</div>)}</div>}
    </section>
  );
}
