import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const items = [
  "Biblioteca",
  "Comunidade",
  "Autores",
  "Recursos",
  "Debates",
  "Clube",
  "Leitura",
  "OPE",
];

export function LogoCloud() {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[24px] border border-[var(--border)] md:grid-cols-4">
      {items.map((item, index) => (
        <LogoCard key={item} className={index % 2 === 0 ? "bg-[var(--bg-surface)]" : "bg-[var(--bg-card)]"}>
          <Logo className="text-[24px] text-[var(--text-secondary)]" />
          <span className="mt-3 text-[10px] font-[600] uppercase tracking-[0.26em] text-[var(--accent-mint)]">
            {item}
          </span>
        </LogoCard>
      ))}
    </div>
  );
}

function LogoCard({ className, children }) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-center justify-center border-r border-b border-[var(--border)] px-4 py-8 last:border-r-0 md:min-h-36",
        "logo-cloud-card",
        className
      )}
    >
      {children}
    </div>
  );
}
