import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, BookOpen, MessageCircle } from "lucide-react";
import { useData } from "../data/DataContext";

export function AuthorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthorById, getBooksByAuthor, posts } = useData();
  const author = getAuthorById(id);
  const authorBooks = getBooksByAuthor(id);
  const authorPosts = posts.filter((post) => post.author_id === id || post.authorId === id);

  if (!author) {
    return (
      <div className="py-16 text-center">
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
        className="mb-6 flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ChevronLeft className="size-4" /> Voltar
      </button>

      <div className="flex flex-col gap-8 md:flex-row">
        <div className="mx-auto w-full max-w-56 shrink-0 md:mx-0 md:w-56">
          <div className="aspect-[3/4] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
            <img src={author.image} alt={author.name} className="h-full w-full object-cover opacity-90" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{author.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{author.theme}</p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
            {author.bio || `${author.name} faz parte do acervo cadastrado no OPE Club.`}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Obras", value: authorBooks.length },
              { label: "Discussões", value: authorPosts.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{stat.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="size-4 text-[var(--text-muted)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Principais obras</h3>
              </div>
              <div className="space-y-2">
                {authorBooks.length > 0 ? authorBooks.map((book) => (
                  <div key={book.id} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                    <span className="size-1 rounded-full bg-[var(--border)]" />
                    {book.title}
                  </div>
                )) : (
                  <p className="text-xs text-[var(--text-muted)]">Nenhum livro cadastrado.</p>
                )}
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="size-4 text-[var(--text-muted)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discussões recentes</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {authorPosts.length ? "Veja as discussões cadastradas pela comunidade." : "Ainda não há discussões cadastradas para este autor."}
              </p>
              <button className="mt-3 text-sm font-medium text-[var(--text-primary)] hover:underline">
                Participar das discussões
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
