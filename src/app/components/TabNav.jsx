const tabs = [
  "Comunidade", "Biblioteca", "Autores", "Clubes", "Eventos", "Em alta", "Meu perfil",
];

export function TabNav({ active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border)] min-w-max sm:min-w-0">
      {tabs.map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`relative px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--text-primary)] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
