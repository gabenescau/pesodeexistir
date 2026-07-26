import { Link } from "react-router-dom";
import { CalendarDays, Lock, Sparkles } from "lucide-react";
import { useData } from "../data/DataContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";

function Capa({ book, children }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
      {book?.image ? (
        <img
          src={book.image}
          alt={book.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-[var(--text-muted)]">
          {book?.title || "Livro"}
        </div>
      )}
      {children}
    </div>
  );
}

export function ReleasesPage() {
  const { weeklyReleases } = useData();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const comData = weeklyReleases
    .map((item) => ({ ...item, data: new Date(`${item.release_date}T00:00:00`) }))
    .filter((item) => !Number.isNaN(item.data.getTime()));

  const liberados = comData.filter((item) => item.data <= hoje).sort((a, b) => b.data - a.data);
  const proximos = comData.filter((item) => item.data > hoje).sort((a, b) => a.data - b.data);

  const DIA = 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-10 pb-24 lg:pb-10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--text-primary)]/10">
          <Sparkles className="size-5 text-[var(--text-primary)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Lançamentos Semanais</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Livros liberados pelos admins toda semana.</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)]">Disponíveis agora</h2>

        {liberados.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
            <CalendarDays className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">Nenhum lançamento liberado ainda.</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Quando o admin programar um livro, ele aparece aqui na data definida.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {liberados.map((release) => {
              const book = release.books;
              if (!book) return null;
              const novo = hoje - release.data <= 7 * DIA;

              return (
                <Link key={release.id} to={`/app/livro/${book.id}`} className="group">
                  <Capa book={book}>
                    {novo && (
                      <span className="absolute right-2 top-2 rounded-full bg-[var(--text-primary)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--bg-card)]">
                        Novo
                      </span>
                    )}
                  </Capa>
                  <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-[var(--text-primary)]">{book.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{book.authors?.name || book.authorName}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {proximos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)]">Em breve</h2>
          <p className="text-xs text-[var(--text-muted)]">
            A capa já aparece, mas a leitura só abre na data — inclusive no servidor.
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
            {proximos.map((release) => {
              const book = release.books;
              const dias = Math.max(0, Math.ceil((release.data - hoje) / DIA));

              return (
                <div key={release.id} className="group cursor-not-allowed" title={`Libera em ${formatarData(release.data)}`}>
                  <Capa book={book}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg-canvas)]/78 p-3 text-center backdrop-blur-[3px]">
                      <Lock className="size-5 text-[var(--text-primary)]" />
                      <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                        {contagemRegressiva(dias)}
                      </span>
                      <span className="text-[10px] leading-tight text-[var(--text-muted)]">
                        {formatarData(release.data)}
                      </span>
                    </div>
                  </Capa>
                  <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-[var(--text-primary)]">
                    {book?.title || "Livro programado"}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                    {book?.authors?.name || book?.authorName || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
