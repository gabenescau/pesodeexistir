import { useEffect, useState } from "react";
import { Smartphone, Download } from "@/lib/icons";

const STEPS = {
  android: [
    {
      text: "No Chrome (Android / PC), toque no menu (três pontos ⋮) no canto superior direito.",
    },
    {
      text: 'Selecione a opção "Instalar aplicativo" ou "Instalar OPE Club".',
    },
    {
      text: 'Clique em "Instalar" para confirmar a instalação na sua área de trabalho/tela inicial.',
    },
    {
      text: "Pronto! O aplicativo abrirá em janela dedicada de alta velocidade.",
    },
  ],
  iphone: [
    {
      text: 'No Safari do iPhone, toque no ícone de Compartilhar (quadrado com seta pra cima) na barra inferior.',
    },
    {
      text: 'Role para baixo e selecione "Adicionar à Tela de Início".',
    },
    {
      text: 'Toque em "Adicionar" no canto superior direito.',
    },
    {
      text: "Pronto! O ícone do OPE Club estará disponível na sua tela de início.",
    },
  ],
};

export function InstallAppWidget() {
  const [tab, setTab] = useState("android");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-[var(--accent-mint)]" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Instalar Aplicativo
        </h3>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Instale o aplicativo OPE Club no seu celular ou computador para ter navegação em tela cheia e acesso rápido.
      </p>

      {/* Botão de instalação direta do Chrome (quando suportado) */}
      {deferredPrompt && !isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--text-primary)] py-2.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
        >
          <Download className="size-4" /> Instalar OPE Club no Dispositivo
        </button>
      )}

      {isInstalled && (
        <div className="rounded-[8px] border border-green-500/30 bg-green-500/10 p-2.5 text-center text-xs font-semibold text-green-400">
          ✓ OPE Club já está instalado no seu dispositivo!
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-0.5">
        {[
          { id: "android", label: "Chrome / Android / PC" },
          { id: "iphone", label: "Safari / iPhone" },
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
        Suporta instalação nativa PWA em todos os navegadores modernos (Chrome, Safari, Edge, Brave).
      </p>
    </section>
  );
}
