import { Link } from "react-router-dom";
import { ArrowLeft } from "@/lib/icons";
import { InstallAppWidget } from "@/app/components/InstallAppWidget";

export function InstallAppPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/app/inicio"
          className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Instalar Aplicativo</h1>
          <p className="text-xs text-[var(--text-muted)]">Como adicionar o OPE Club à tela inicial do seu celular.</p>
        </div>
      </div>

      <InstallAppWidget />
    </div>
  );
}
