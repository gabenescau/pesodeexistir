import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useData } from "../data/DataContext";

export function ReleasesPage() {
  const { books, authors } = useData();

  const items = books.map(b => ({
    ...b,
    authorName: authors.find(a => a.id === b.authorId)?.name || b.authorName || "",
  }));

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-2xl bg-[var(--text-primary)]/10 flex items-center justify-center">
          <Sparkles className="size-5 text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lançamentos Semanais</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Novos livros adicionados à nossa coleção.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {items.map(b => (
          <Link key={b.id} to={`/app/livro/${b.id}`} className="group cursor-pointer">
            <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] relative">
              <img
                src={b.image}
                alt={b.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[var(--text-primary)]/90 text-[var(--bg-card)] text-[10px] font-medium">
                Novo
              </div>
            </div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mt-2 leading-tight">{b.title}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{b.authorName}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
