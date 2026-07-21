export function RightSidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 space-y-5 2xl:block">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
          Comunidade
        </h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
          A maior comunidade brasileira para quem ama filosofia, literatura e
          grandes ideias.
        </p>
        <div className="space-y-3 text-sm">
          {[
            { label: "Membros", value: "2.847" },
            { label: "Online agora", value: "142", highlight: true },
            { label: "Discussões hoje", value: "89" },
            { label: "Livros nesta semana", value: "12" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{s.label}</span>
              <span className={`font-medium ${s.highlight ? "text-green-400" : "text-[var(--text-primary)]"}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
          Tags em alta
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {[
            "#Nietzsche", "#Camus", "#Kafka", "#Estoicismo",
            "#Existencialismo", "#Psicologia", "#Dostoiévski", "#Filosofia",
          ].map((tag) => (
            <span
              key={tag}
              className="text-xs text-[var(--text-muted)] px-3 py-1.5 rounded-[6px] bg-[var(--hover-overlay)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
          Autores em destaque
        </h3>
        <div className="space-y-3">
          {[
            { name: "Friedrich Nietzsche", works: 15, initial: "N" },
            { name: "Albert Camus", works: 8, initial: "C" },
            { name: "Fiódor Dostoiévski", works: 12, initial: "D" },
          ].map((a) => (
            <div key={a.name} className="flex items-center gap-3 cursor-pointer group">
              <div className="size-8 rounded-[8px] bg-[var(--hover-overlay)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)]">
                {a.initial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors truncate">
                  {a.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{a.works} obras</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
          Livros mais comentados
        </h3>
        <div className="space-y-3">
          {["Crime e Castigo", "O Estrangeiro", "Assim Falou Zaratustra"].map((book) => (
            <div
              key={book}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              {book}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
