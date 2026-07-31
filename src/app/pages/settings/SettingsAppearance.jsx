import { useSearchParams } from "react-router-dom";
import { Monitor, Moon, Smartphone, Sun } from "@/lib/icons";
import { SettingsLayout, SettingsSection, SettingsToggle } from "../../components/SettingsLayout";
import { useTheme } from "@/components/theme-provider";

export function SettingsAppearance() {
  const [, setSearchParams] = useSearchParams();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <SettingsLayout
      title="Aparencia"
      subtitle="Tema do aplicativo"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={isDark ? Moon : Sun} label="Tema">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">Modo {isDark ? "escuro" : "claro"}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              {isDark ? "Reduz o brilho em ambientes com pouca luz." : "Mais legivel em ambientes bem iluminados."}
            </p>
          </div>
          <SettingsToggle value={isDark} onChange={toggleTheme} />
        </div>
      </SettingsSection>

      <SettingsSection label="Pre-visualizacao">
        <div className="grid grid-cols-2 gap-2 p-4 sm:gap-3 sm:p-5">
          <button
            type="button"
            onClick={() => isDark && toggleTheme()}
            className={`flex flex-col items-start gap-2 rounded-[12px] border p-3 text-left transition-colors sm:p-4 ${
              isDark ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/5" : "border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="size-4 text-[var(--text-muted)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Escuro</span>
            </div>
            <div className="h-16 w-full rounded-[8px] bg-[#0b0b0c] ring-1 ring-white/10" />
          </button>
          <button
            type="button"
            onClick={() => !isDark && toggleTheme()}
            className={`flex flex-col items-start gap-2 rounded-[12px] border p-3 text-left transition-colors sm:p-4 ${
              !isDark ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/5" : "border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="size-4 text-[var(--text-muted)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Claro</span>
            </div>
            <div className="h-16 w-full rounded-[8px] bg-white ring-1 ring-black/5" />
          </button>
        </div>
        <p className="px-4 pb-4 text-[11px] text-[var(--text-muted)] sm:px-5">
          A escolha e salva no seu navegador e sincroniza com o seu perfil.
        </p>
      </SettingsSection>

      <div className="rounded-[12px] border border-dashed border-[var(--border)] p-4 text-center text-[11px] text-[var(--text-muted)] sm:p-5 sm:text-xs">
        <Smartphone className="mx-auto mb-1.5 size-4 text-[var(--text-muted)]" />
        O tema segue o do sistema nas proximas atualizacoes.
        <div className="mt-1 flex items-center justify-center gap-1 text-[var(--text-muted)]">
          <Monitor className="size-3" /> Em breve
        </div>
      </div>
    </SettingsLayout>
  );
}
