import { useState, useRef } from "react";
import { AtSign, BookOpen, Image, Plus, UserRound, X } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";

const TAGS = ["Filosofia", "Literatura", "Ciência", "Política", "Arte", "História", "Poesia", "Romance", "Conto", "Ensaio"];

function Avatar({ src, fallback }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http"));

  return (
    <div className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]">
      {isImage ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      )}
    </div>
  );
}

export function CreatePost() {
  const { user, profile } = useAuth();
  const { addPost, books, authors } = useData();
  const fileInputRef = useRef(null);
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [bookId, setBookId] = useState(null);
  const [images, setImages] = useState([]);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const name = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Você";
  const handle = user?.email?.split("@")[0] || name.toLowerCase().replace(/\s+/g, "_");
  const avatar = profile?.avatar || user?.user_metadata?.avatar_url;
  const initial = name.charAt(0).toUpperCase();
  const selectedBook = books.find((book) => book.id === bookId);

  function addText(value) {
    setText((current) => `${current}${current.trim() ? " " : ""}${value} `);
    setMenu(null);
  }

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!text.trim() || publishing) return;
    setError("");
    setPublishing(true);

    try {
      await addPost({
        userId: user?.id,
        text: text.trim(),
        tag: tag || null,
        bookId,
        images,
        author: name,
        avatar: avatar || initial,
      });
      setText("");
      setTag("");
      setBookId(null);
      setImages([]);
      setMenu(null);
    } catch (err) {
      setError(err?.message || "Não foi possível publicar. Confira as permissões no Supabase.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-strong)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={avatar} fallback={initial} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">@{handle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenu(menu === "more" ? null : "more")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
          aria-label="Abrir opções do post"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <textarea
        placeholder="O que você está pensando hoje?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="min-h-24 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)]"
      />

      {(images.length > 0 || selectedBook) && (
        <div className="space-y-3">
          {images.length > 0 && (
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {images.map((src, index) => (
                <div key={index} className="relative h-36 w-56 shrink-0 snap-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)]">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label="Remover imagem"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedBook && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)] p-3">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--bg-card)]">
                {selectedBook.image ? <img src={selectedBook.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{selectedBook.title}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{selectedBook.authorName || selectedBook.author}</p>
              </div>
              <button type="button" onClick={() => setBookId(null)} className="text-xs text-[var(--text-muted)] hover:text-red-400">remover</button>
            </div>
          )}
        </div>
      )}

      {menu && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <Image className="size-4" /> Imagem
            </button>
            <button type="button" onClick={() => setMenu(menu === "books" ? "more" : "books")} className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <BookOpen className="size-4" /> Livro
            </button>
            <button type="button" onClick={() => setMenu(menu === "authors" ? "more" : "authors")} className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <UserRound className="size-4" /> Autor
            </button>
            <button type="button" onClick={() => setMenu(menu === "tags" ? "more" : "tags")} className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
              <AtSign className="size-4" /> Tag
            </button>
          </div>

          {menu === "books" && (
            <div className="mt-3 flex max-h-44 flex-col gap-1 overflow-y-auto">
              {books.map((book) => (
                <button key={book.id} type="button" onClick={() => { setBookId(book.id); addText(`"${book.title}"`); }} className="rounded-lg px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                  {book.title}
                </button>
              ))}
            </div>
          )}

          {menu === "authors" && (
            <div className="mt-3 flex max-h-44 flex-col gap-1 overflow-y-auto">
              {authors.map((author) => (
                <button key={author.id} type="button" onClick={() => addText(`@${author.name.replace(/\s+/g, "")}`)} className="rounded-lg px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                  {author.name}
                </button>
              ))}
            </div>
          )}

          {menu === "tags" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {TAGS.map((item) => (
                <button key={item} type="button" onClick={() => { setTag(item); addText(`#${item}`); }} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
        <p className="text-xs text-[var(--text-muted)]">Imagem, livro, autor ou tag pelo botão +</p>
        <button
          disabled={!text.trim() || publishing}
          onClick={handleSubmit}
          className="rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {publishing ? "Publicando..." : "Publicar"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
