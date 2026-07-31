import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronLeft, Heart, Lock, Share2, MoreHorizontal } from "@/lib/icons";
import { useData } from "../data/DataContext";
import { useAuth } from "../data/AuthContext";
import { contagemRegressiva, formatarData } from "@/lib/releases";

const TABS = ["Resumo", "Capitulos"];

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getBookById, getAuthorById, markBookCompleted, getReleaseStatus, toggleFavoriteBook, isFavoriteBook, books } = useData();
  const book = getBookById(id);
  const release = getReleaseStatus(id);
  const [activeTab, setActiveTab] = useState("Resumo");
  const [menuOpen, setMenuOpen] = useState(false);

  if (!book) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-muted)]">Livro nao encontrado.</p>
        <button onClick={() => navigate("/app/biblioteca")} className="mt-4 text-sm text-[var(--text-primary)] hover:underline">
          Voltar para biblioteca
        </button>
      </div>
    );
  }

  const author = getAuthorById(book.authorId || book.author_id);
  const hasPdf = Boolean(book.pdfFile || book.pdf_url);
  const favoritado = isFavoriteBook(book.id);
  const progresso = Number(book.progress || 0);
  const isCompleted = progresso >= 100;
  const status = isCompleted ? "Concluido" : progresso > 0 ? "Em leitura" : "Nao iniciado";

  // Livros relacionados (mesma categoria, excluindo este)
  const relatedBooks = books
    .filter((b) => b.id !== book.id && b.category && b.category === book.category)
    .slice(0, 6);

  function handleStartReading() {
    if (hasPdf && release.liberado) {
      navigate(`/app/ler/${book.id}`);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-[var(--bg-page)] px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-5 text-[var(--text-primary)]" />
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover-overlay)]"
          aria-label="Mais opcoes"
        >
          <MoreHorizontal className="size-5 text-[var(--text-primary)]" />
        </button>
      </div>

      {/* Hero: capa + info */}
      <div className="flex gap-4 px-4 pb-4 sm:gap-5">
        {/* Capa */}
        <div className="w-[32%] shrink-0 sm:w-[36%] md:w-[30%]">
          <div className="aspect-[2/3] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
            <img
              src={book.image}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-[16px] font-[700] leading-[22px] tracking-[-0.32px] text-[var(--text-primary)] sm:text-[18px] sm:leading-[24px] sm:tracking-[-0.36px]">
            {book.title}
          </h1>

          {author && (
            <Link to={`/app/autor/${author.id}`} className="mt-2 flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:underline sm:text-sm">
              {author.image ? (
                <img src={author.image} alt="" className="size-5 rounded-full object-cover" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-[10px] font-bold text-[var(--text-muted)]">
                  {author.name?.charAt(0)}
                </span>
              )}
              {author.name}
            </Link>
          )}

          {/* Status + categoria */}
          <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] sm:text-sm">
              <BookOpen className="size-4 shrink-0 text-[var(--text-muted)]" />
              {status}
            </div>
            {book.category && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] sm:text-sm">
                <span className="size-1.5 rounded-full bg-[var(--text-muted)]" />
                {book.category}
              </div>
            )}
          </div>

          {/* Tags */}
          {book.tag && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {book.tag.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Botoes de acao - inline, antes das tabs */}
      <div className="flex items-center gap-2.5 px-4 pb-4 sm:gap-3">
        <button
          onClick={handleStartReading}
          disabled={!hasPdf || !release.liberado}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[13px] font-medium text-[var(--bg-card)] transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed sm:h-12 sm:text-sm"
        >
          <BookOpen className="size-4" />
          {hasPdf && release.liberado ? "Comecar a ler" : "Indisponivel"}
        </button>
        <button
          onClick={() => toggleFavoriteBook(book.id)}
          className={`flex size-11 items-center justify-center rounded-full border transition-colors sm:size-12 ${
            favoritado
              ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"
              : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
          }`}
          aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {favoritado ? (
            <CheckCircle2 className="size-5" />
          ) : (
            <span className="text-xl leading-none">+</span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] px-4">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--accent-mint)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conteudo da aba */}
      <div className="flex-1 px-4 pt-5">
        {activeTab === "Resumo" && (
          <div className="space-y-6">
            {/* Sinopse / bio */}
            {book.bio ? (
              <div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
                  {book.bio}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sinopse indisponivel.</p>
            )}

            {/* Progresso */}
            {progresso > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Progresso</span>
                  <span>{progresso}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                  <div className="h-full rounded-full bg-[var(--accent-mint)]" style={{ width: `${progresso}%` }} />
                </div>
              </div>
            )}

            {/* Liberacao */}
            {hasPdf && !release.liberado && (
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
                <Lock className="mx-auto mb-1.5 size-4 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Libera em {formatarData(release.data)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{contagemRegressiva(release.diasRestantes)}</p>
              </div>
            )}

            {/* Livros relacionados */}
            {relatedBooks.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Voce tambem pode gostar</h3>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {relatedBooks.map((rb) => (
                    <button
                      key={rb.id}
                      onClick={() => navigate(`/app/livro/${rb.id}`)}
                      className="w-[120px] shrink-0 text-left"
                    >
                      <div className="aspect-[2/3] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)]">
                        <img src={rb.image} alt="" className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium text-[var(--text-primary)]">{rb.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasPdf && (
              <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-secondary)]">Nenhum PDF disponivel para este livro ainda.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "Capitulos" && (
          <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Os capitulos serao disponibilizados em breve.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
