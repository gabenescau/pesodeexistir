import { ChevronLeft, MoreHorizontal } from "@/lib/icons";

// Shell padrao das sub-telas de Configuracoes: cabecalho com voltar + titulo,
// e conteudo em coluna unica. Usado por todas as telas (Editar perfil,
// Seguranca, Notificacoes, etc.) para manter consistencia visual.
export function SettingsLayout({ title, subtitle, onBack, rightSlot, children }) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-24 lg:pb-8">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-page)]/90 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
              aria-label="Voltar"
            >
              <ChevronLeft className="size-5 text-[var(--text-primary)]" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)] sm:text-lg">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-[var(--text-muted)] sm:text-xs">{subtitle}</p> : null}
          </div>
        </div>
        {rightSlot ?? <MoreHorizontal className="size-5 shrink-0 text-transparent" aria-hidden="true" />}
      </div>
      <div className="mt-4 space-y-6 sm:mt-6">{children}</div>
    </div>
  );
}

export function SettingsSection({ icon: Icon, label, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] ${className}`} style={{ boxShadow: "var(--shadow-sm)" }}>
      {label ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          {Icon ? <Icon className="size-4 text-[var(--text-muted)]" /> : null}
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</h2>
        </div>
      ) : null}
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

export function SettingsRow({ icon: Icon, title, description, right, onClick, danger }) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-500/10 text-red-400" : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"}`}>
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${danger ? "text-red-400" : "text-[var(--text-primary)]"}`}>{title}</p>
          {description ? <p className="truncate text-[11px] text-[var(--text-muted)]">{description}</p> : null}
        </div>
      </div>
      {right ?? <ChevronLeft className="size-4 -rotate-180 shrink-0 text-[var(--border-strong)]" />}
    </>
  );
  if (!onClick) return <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">{content}</div>;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--hover-overlay)] sm:px-5">
      {content}
    </button>
  );
}

export function SettingsToggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        value ? "bg-[var(--accent-mint)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 size-[22px] rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
