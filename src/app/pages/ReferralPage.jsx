import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, Gift, Loader2, Users, WhatsappLogo } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { useRewards } from "@/app/data/RewardsContext";
import { useAuth } from "@/app/data/AuthContext";

const REFERRAL_REWARD = 100;

export function ReferralPage() {
  const { getMyReferralCode, getMyReferrals, referralClaim, refresh } = useRewards();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const userId = user?.id;
      if (!userId) return;
      const [codeResult, rowsResult] = await Promise.all([
        getMyReferralCode(),
        getMyReferrals(),
      ]);
      setCode(codeResult || "");
      setReferrals(rowsResult || []);
    } catch (loadError) {
      setError(loadError?.message || "Nao foi possivel carregar suas indicacoes.");
    } finally { setLoading(false); }
  }, [getMyReferralCode, getMyReferrals, user?.id]);

  useEffect(() => { load(); }, [load]);

  const link = code ? `${window.location.origin}/entrar?ref=${code}` : "";
  const confirmed = referrals.filter((item) => item.rewarded_at).length;
  const pending = referrals.length - confirmed;

  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); toast.success("Link de indicacao copiado!"); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error("Nao foi possivel copiar o link."); }
  }

  function shareWhatsApp() {
    if (link) window.open(`https://wa.me/?text=${encodeURIComponent(`Entre no OPE Club pelo meu convite: ${link}`)}`, "_blank", "noopener,noreferrer");
  }

  async function claim(id) {
    if (busy) return;
    setBusy(id);
    try { await referralClaim(id); toast.success(`Recompensa creditada! +${REFERRAL_REWARD} creditos.`); await refresh(); await load(); }
    catch (claimError) { toast.error(claimError?.message || "O convidado ainda nao possui assinatura ativa."); }
    finally { setBusy(""); }
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 pb-10">
      <Link to="/app/loja" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArrowLeft className="size-4" /> Voltar para a loja</Link>
      <header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Indicacoes</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Convide pessoas para o OPE Club e receba creditos quando a assinatura for confirmada.</p></header>
      {error && <p role="alert" className="rounded-[10px] border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Indicados</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{referrals.length}</p></div><div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confirmados</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{confirmed}</p></div><div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Creditos ganhos</p><p className="mt-1 text-2xl font-bold text-[#c58b42]">{confirmed * REFERRAL_REWARD}</p></div></div>
      <section className="space-y-4 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Seu codigo</p><p className="mt-2 text-3xl font-black tracking-wider text-[var(--text-primary)]">{code || "--"}</p></div><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={copyLink} disabled={!link} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[9px] border border-[var(--border)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-40">{copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />} {copied ? "Copiado" : "Copiar link"}</button><button type="button" onClick={shareWhatsApp} disabled={!link} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-[var(--text-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--bg-card)] disabled:opacity-40"><WhatsappLogo className="size-4" /> Compartilhar</button></div><p className="break-all rounded-[9px] bg-[var(--bg-canvas)] p-3 font-mono text-xs text-[var(--text-muted)]">{link || "Entre para gerar seu link."}</p><p className="text-xs text-[var(--text-muted)]">Cada indicacao confirmada rende +{REFERRAL_REWARD} creditos.</p></section>
      <section className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)]"><div className="border-b border-[var(--border)] px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Historico ({referrals.length})</p></div>{loading ? <div className="p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-[var(--text-muted)]" /></div> : referrals.length === 0 ? <div className="p-8 text-center"><Users className="mx-auto size-8 text-[var(--text-muted)]" /><p className="mt-2 text-sm text-[var(--text-muted)]">Nenhuma indicacao ainda.</p></div> : <div className="divide-y divide-[var(--border)]">{referrals.map((item) => <div key={item.referred_user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[var(--text-primary)]">Membro indicado</p><p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div>{item.rewarded_at ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400"><Check className="size-4" /> Recompensado</span> : <button type="button" disabled={busy === item.referred_user_id} onClick={() => claim(item.referred_user_id)} className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-40"><Gift className="size-3.5" /> {busy === item.referred_user_id ? "Validando" : "Reclamar"}</button>}</div>)}</div>}</section>
      {pending > 0 && <p className="text-center text-xs text-[var(--text-muted)]">{pending} indicacao(oes) aguardando assinatura ativa.</p>}
    </div>
  );
}
