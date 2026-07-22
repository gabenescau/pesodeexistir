import { Link } from "react-router-dom";
import { CalendarDays, Sparkles } from "lucide-react";
import { useData } from "../data/DataContext";

export function ReleasesPage() {
  const { weeklyReleases } = useData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const released = weeklyReleases.filter((item) => {
    const releaseDate = new Date(`${item.release_date}T00:00:00`);
    return releaseDate <= today;
  });

  const upcoming = weeklyReleases.filter((item) => {
    const releaseDate = new Date(`${item.release_date}T00:00:00`);
    return releaseDate > today;
  });

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--text-primary)]/10">
          <Sparkles className="size-5 text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lançamentos Semanais</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Livros liberados pelos admins toda semana.</p>
        </div>
      </div>

      {released.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <CalendarDays className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
          <p className="text-sm font-medium text-[var(--text-primary)]">Nenhum lançamento liberado ainda.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Quando o admin programar um livro, ele aparece aqui na data definida.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {released.map((release) => {
            const book = release.books;
            if (!book) return null;
            return (
              <Link key={release.id} to={`/app/livro/${book.id}`} className="group cursor-pointer">
                <div className="relative aspect-[3/4] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
                  {book.image ? (
                    <img src={book.image} alt={book.title} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105" />
                  ) : null}
                  <div className="absolute right-2 top-2 rounded-full bg-[var(--text-primary)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--bg-card)]">
                    Novo
                  </div>
                </div>
                <h3 className="mt-2 text-sm font-medium leading-tight text-[var(--text-primary)]">{book.title}</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{book.authors?.name || book.authorName}</p>
              </Link>
            );
          })}
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.6px] text-[var(--text-muted)]">Próximos</h2>
          {upcoming.map((release) => (
            <div key={release.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">{release.books?.title || "Livro programado"}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Libera em {new Date(`${release.release_date}T00:00:00`).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
