import { useEffect, useState } from "react";
import { CheckCircle, Copy, Loader2, X } from "@/lib/icons";
import { formatBRL } from "@/lib/plans";

function formatDocument(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function qrImageSource(encodedImage) {
  if (!encodedImage) return "";
  return String(encodedImage).startsWith("data:")
    ? encodedImage
    : `data:image/png;base64,${encodedImage}`;
}

export function AsaasPixModal({
  isOpen,
  plan,
  defaultEmail,
  defaultName,
  working,
  error,
  payment,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({ name: defaultName || "", email: defaultEmail || "", cpfCnpj: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    setForm((current) => ({
      ...current,
      email: defaultEmail || current.email,
      name: defaultName || current.name,
    }));
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [defaultEmail, defaultName, isOpen, onClose, working]);

  if (!isOpen) return null;

  async function copyPayload() {
    if (!payment?.qrCode?.payload || !navigator.clipboard) return;
    await navigator.clipboard.writeText(payment.qrCode.payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="asaas-pix-title">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Pagamento seguro</p>
            <h2 id="asaas-pix-title" className="mt-1 text-xl font-bold text-[var(--text-primary)]">Gerar Pix</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{plan?.name} · {plan ? formatBRL(plan.price) : ""}</p>
          </div>
          <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50" onClick={onClose} disabled={Boolean(working)} aria-label="Fechar">
            <X className="size-5" />
          </button>
        </header>

        {!payment ? (
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="pix-name">Nome completo</label>
              <input id="pix-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={80} autoComplete="name" required className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]" placeholder="Seu nome completo" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="pix-email">Email da conta</label>
              <input id="pix-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} maxLength={254} autoComplete="email" required className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]" placeholder="voce@email.com" />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Usaremos o email autenticado para vincular o pagamento à sua conta.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="pix-document">CPF ou CNPJ</label>
              <input id="pix-document" value={formatDocument(form.cpfCnpj)} onChange={(event) => updateField("cpfCnpj", event.target.value)} inputMode="numeric" autoComplete="off" required className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]" placeholder="000.000.000-00" />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Obrigatório para emitir a cobrança Pix na Asaas. Não armazenamos este documento.</p>
            </div>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{error}</p>}
            <button type="submit" disabled={Boolean(working)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-card)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
              {working ? <><Loader2 className="size-4 animate-spin" /> Gerando Pix...</> : "Gerar Pix"}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-[var(--text-muted)]">O plano só será liberado após a confirmação do recebimento pela Asaas.</p>
          </form>
        ) : (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--accent-mint)]/15 text-[var(--accent-mint)]"><CheckCircle className="size-6" /></div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Pix gerado</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Escaneie o QR Code ou copie o código para pagar.</p>
            </div>
            <div className="mx-auto w-fit rounded-2xl border border-[var(--border)] bg-white p-3"><img src={qrImageSource(payment.qrCode?.encodedImage)} alt="QR Code Pix para pagamento" className="size-52 sm:size-60" /></div>
            <button type="button" onClick={copyPayload} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"><Copy className="size-4" /> {copied ? "Código copiado" : "Copiar Pix copia e cola"}</button>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">Aguardando confirmação. Você pode fechar esta janela; o pagamento será conciliado pelo webhook da Asaas.</p>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
