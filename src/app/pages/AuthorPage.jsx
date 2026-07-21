import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Quote, BookOpen, MessageCircle } from "lucide-react";
import { useData } from "../data/DataContext";

export function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthorById, getBooksByAuthor } = useData();
  const author = getAuthorById(id);
  const authorBooks = getBooksByAuthor(id);

  if (!author) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--text-muted)]">Autor não encontrado.</p>
        <button onClick={() => navigate("/app/explorar")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para explorar
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="mx-auto w-full max-w-56 shrink-0 md:mx-0 md:w-56">
          <div className="aspect-[3/4] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
            <img src={author.image} alt={author.name} className="w-full h-full object-cover opacity-80" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{author.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{author.theme}</p>
          <p className="text-sm text-[var(--text-muted)] mt-4 leading-relaxed max-w-xl">
            {author.name} é um dos pensadores mais influentes do {author.era},
            conhecido por suas contribuições fundamentais para a {author.theme?.toLowerCase()}.
            Suas obras continuam a inspirar leitores ao redor do mundo.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {[
              { label: "Obras", value: authorBooks.length },
              { label: "Discussões", value: 156 },
              { label: "Seguidores", value: 892 },
              { label: "Citações", value: 47 },
            ].map((s) => (
              <div key={s.label} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{s.value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Quote className="size-4 text-[var(--text-muted)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Frases</h3>
              </div>
              <div className="space-y-3">
                {[
                  { text: "Aquele que tem um porquê viver pode suportar quase qualquer como.", source: "Crepúsculo dos Ídolos" },
                  { text: "O que não me mata me fortalece.", source: "Crepúsculo dos Ídolos" },
                ].map((q) => (
                  <div key={q.text} className="p-3 rounded-[8px] bg-[var(--hover-overlay)] border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">&ldquo;{q.text}&rdquo;</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{q.source}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="size-4 text-[var(--text-muted)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Principais obras</h3>
              </div>
              <div className="space-y-2">
                {authorBooks.length > 0 ? authorBooks.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                    <span className="size-1 rounded-full bg-[var(--border)]" />
                    {b.title}
                  </div>
                )) : <p className="text-xs text-[var(--text-muted)]">Nenhum livro cadastrado.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="size-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discussões recentes</h3>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Comunidade ativa com 156 discussões sobre {author.name}.</p>
            <button className="mt-3 text-sm text-[var(--text-primary)] font-medium hover:underline">
              Participar das discussões
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
