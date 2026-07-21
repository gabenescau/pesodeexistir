const filters = [
  "Todos", "Discussões", "Livros", "Autores",
  "Filosofia", "Literatura", "Psicologia",
  "Existencialismo", "Estoicismo", "Perguntas", "Recomendações",
];

export function FilterPills({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
            active === f
              ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
              : "text-[var(--text-muted)] bg-[var(--hover-overlay)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
