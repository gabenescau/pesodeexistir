import { useState } from "react";
import { Smartphone } from "@/lib/icons";

const STEPS = {
  android: [
    {
      icon: "⋮",
      text: "Toque no menu (três pontos) no canto superior direito do Chrome",
    },
    {
      icon: "＋",
      text: 'Selecione "Adicionar à tela inicial"',
    },
    {
      icon: "✓",
      text: 'Toque em "Adicionar" para confirmar',
    },
    {
      icon: "🚀",
      text: "Pronto! O app aparece na sua tela inicial",
    },
  ],
  iphone: [
    {
      icon: "⎋",
      text: 'Toque no ícone de compartilhar (quadrado com seta) na barra inferior do Safari',
    },
    {
      icon: "＋",
      text: 'Role para baixo e selecione "Adicionar à Tela de Início"',
    },
    {
      icon: "✓",
      text: 'Toque em "Adicionar" no canto superior direito',
    },
    {
      icon: "🚀",
      text: "Pronto! O OPE Club abre como app nativo",
    },
  ],
};

export function InstallAppWidget() {
  const [tab, setTab] = useState("android");

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-[var(--accent-mint)]" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Instalar como App
        </h3>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Adicione o OPE Club à sua tela inicial para acesso rápido, como um app nativo.
      </p>

      {/* Tab switcher */}
      <div className="flex rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-0.5">
        {[
          { id: "android", label: "Android" },
          { id: "iphone", label: "iPhone" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-[6px] py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {STEPS[tab].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-canvas)] text-[10px] font-bold text-[var(--text-muted)]">
              {i + 1}
            </span>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)] pt-0.5">
              {step.text}
            </p>
          </li>
        ))}
      </ol>

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
        Funciona no Chrome (Android) e Safari (iPhone). O app abre sem barra de navegador.
      </p>
    </section>
  );
}
