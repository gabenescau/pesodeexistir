import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users, Copy, WhatsappLogo, Check, Gift } from "@/lib/icons";
import { toast } from "@/lib/toast";

const MOCK_REFERRALS = [
  {
    id: "r-1",
    name: "Lucas Andrade",
    email: "lucas@gmail.com",
    plan: "Plano Anual",
    date: "01/08/2026",
    status: "Em validação",
  },
  {
    id: "r-2",
    name: "Mariana Costa",
    email: "mariana@gmail.com",
    plan: "Plano Mensal",
    date: "05/07/2026",
    status: "Confirmado",
  },
  {
    id: "r-3",
    name: "Rafael Silveira",
    email: "rafael@gmail.com",
    plan: "Conta Criada",
    date: "06/08/2026",
    status: "Pendente",
  },
];

function StatusBadge({ status }) {
  const isConfirmed = status === "Confirmado";
  const isValidating = status === "Em validação";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isConfirmed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : isValidating
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
      }`}
    >
      {status}
    </span>
  );
}

export function ReferralPage() {
  const code = "GABE OPE";
  const link = "https://opeclub.app/invite/gabeope";
  const [copied, setCopied] = useState(false);

  const confirmed = MOCK_REFERRALS.filter((r) => r.status === "Confirmado").length;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Link de indicação copiado!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Oi! Estou te indicando para o OPE Club. Use meu link para se cadastrar e ganhar 20 créditos: ${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
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
          Programa de Indicações
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Indique amigos para o OPE Club e acumule créditos a cada assinatura confirmada.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total de Indicados</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{MOCK_REFERRALS.length}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">amigos no total</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confirmadas</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{confirmed}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">assinaturas ativas</p>
        </div>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Créditos Ganhos</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">+{confirmed * 50}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">50 créditos por indicação</p>
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
              {code}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors w-full sm:w-auto"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-[var(--text-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              <WhatsappLogo className="size-4" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Caixinha do Link */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3.5 py-2.5">
          <p className="text-xs text-[var(--text-muted)] font-mono break-all selection:bg-[var(--hover-overlay)]">
            {link}
          </p>
        </div>

        {/* Recompensas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sua Recompensa</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">+50 Créditos</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">por amigo que assinar um plano</p>
          </div>
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Recompensa do Amigo</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">+20 Créditos</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">ao criar conta usando seu link</p>
          </div>
        </div>
      </div>

      {/* Lista de Amigos Indicados */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Amigos Indicados ({MOCK_REFERRALS.length})
          </p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {MOCK_REFERRALS.map((ref) => (
            <div key={ref.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--hover-overlay)] transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{ref.name}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{ref.email}</p>
              </div>

              <div className="flex items-center justify-between sm:gap-4 text-xs">
                <span className="text-[var(--text-muted)]">{ref.plan} · {ref.date}</span>
                <StatusBadge status={ref.status} />
              </div>
            </div>
          ))}

          {MOCK_REFERRALS.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Users className="size-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Nenhuma indicação realizada ainda.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

