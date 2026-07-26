import { useMemo, useRef, useState } from "react";
import { BookOpen, Image, UserRound, X } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { handleDoPerfil, normalizar, resolverMencao, tokenizarMencoes } from "@/lib/mentions";

// Espelham os CHECKs de public.posts (migration 00011).
const MAX_TEXTO = 5000;
const MAX_IMAGENS = 4;
const MAX_BYTES_IMAGEM = 700 * 1024;

function Avatar({ src, fallback, className = "size-11" }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http") || src?.startsWith?.("/"));
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]`}>
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
  const { addPost, books, authors, profiles } = useData();
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [text, setText] = useState("");
  const [bookId, setBookId] = useState(null);
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Autocomplete de @: guarda o intervalo do token sendo digitado.
  const [mention, setMention] = useState(null); // { query, start, end }

  const name = profile?.name || user?.user_metadata?.name || "Você";
  const handle = handleDoPerfil(profile);
  const avatar = profile?.avatar || user?.user_metadata?.avatar_url;
  const initial = name.charAt(0).toUpperCase();
  const selectedBook = books.find((book) => book.id === bookId);

  // Chips de autores/pessoas mencionados: derivados do texto (nada de estado
  // paralelo que possa dessincronizar quando o usuário edita).
  const mentionedChips = useMemo(() => {
    const vistos = new Set();
    const chips = [];
    for (const parte of tokenizarMencoes(text)) {
      if (parte.tipo !== "mencao") continue;
      const alvo = resolverMencao(parte.valor, { profiles, authors });
      if (!alvo || vistos.has(`${alvo.tipo}-${alvo.id}`)) continue;
      vistos.add(`${alvo.tipo}-${alvo.id}`);
      const dado = alvo.tipo === "perfil"
        ? profiles.find((p) => p.id === alvo.id)
        : authors.find((a) => a.id === alvo.id);
      chips.push({ ...alvo, image: alvo.tipo === "perfil" ? dado?.avatar : dado?.image });
    }
    return chips;
  }, [text, profiles, authors]);

  // Sugestões para o @ em digitação: pessoas, autores e livros.
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = normalizar(mention.query);
    const casa = (valor) => !q || normalizar(valor).includes(q);

    const pessoas = profiles
      .filter((p) => p.id !== user?.id && (casa(p.name) || casa(p.username)))
      .slice(0, 4)
      .map((p) => ({ tipo: "pessoa", id: p.id, rotulo: p.name || "Leitor", sub: `@${handleDoPerfil(p)}`, image: p.avatar, insert: `@${handleDoPerfil(p)}` }));

    const autoresList = authors
      .filter((a) => casa(a.name))
      .slice(0, 4)
      .map((a) => ({ tipo: "autor", id: a.id, rotulo: a.name, sub: "Autor", image: a.image, insert: `@${(a.name || "").replace(/\s+/g, "")}` }));

    const livros = books
      .filter((b) => casa(b.title))
      .slice(0, 4)
      .map((b) => ({ tipo: "livro", id: b.id, rotulo: b.title, sub: b.authorName || b.author || "Livro", image: b.image, book: b }));

    return [...pessoas, ...autoresList, ...livros].slice(0, 8);
  }, [mention, profiles, authors, books, user?.id]);

  // Detecta o token "@..." imediatamente antes do cursor.
  function onTextChange(event) {
    const value = event.target.value.slice(0, MAX_TEXTO);
    setText(value);

    const caret = event.target.selectionStart ?? value.length;
    const antes = value.slice(0, caret);
    const match = antes.match(/(^|\s)@([\p{L}0-9_]*)$/u);
    if (match) {
      setMention({ query: match[2], start: caret - match[2].length - 1, end: caret });
    } else {
      setMention(null);
    }
  }

  function aplicarSugestao(sugestao) {
    if (sugestao.tipo === "livro") {
      setBookId(sugestao.id);
    }
    const insertText = sugestao.insert || `"${sugestao.rotulo}"`;
    const { start, end } = mention;
    const novo = `${text.slice(0, start)}${insertText} ${text.slice(end)}`.slice(0, MAX_TEXTO);
    setText(novo);
    setMention(null);
    // Devolve o foco e posiciona o cursor depois da menção inserida.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = start + insertText.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    if (files.some((file) => file.size > MAX_BYTES_IMAGEM)) {
      setError("Cada imagem precisa ter no máximo 700 KB.");
    }
    const validas = files.filter((file) => file.size <= MAX_BYTES_IMAGEM);

    setImages((prev) => {
      const espaco = MAX_IMAGENS - prev.length;
      if (espaco <= 0) {
        setError(`Máximo de ${MAX_IMAGENS} imagens por publicação.`);
        return prev;
      }
      validas.slice(0, espaco).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => setImages((atual) => (atual.length >= MAX_IMAGENS ? atual : [...atual, ev.target.result]));
        reader.readAsDataURL(file);
      });
      return prev;
    });
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!text.trim() || publishing) return;
    setError("");
    setPublishing(true);
    try {
      await addPost({
        userId: user?.id,
        text: text.trim(),
        tag: null,
        bookId,
        images,
        author: name,
        avatar: avatar || initial,
      });
      setText("");
      setBookId(null);
      setImages([]);
      setMention(null);
    } catch (err) {
      setError(err?.message || "Não foi possível publicar. Confira as permissões no Supabase.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="relative flex w-full flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-strong)] sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={avatar} fallback={initial} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">@{handle}</p>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          placeholder="O que você está pensando? Use @ para marcar pessoas, autores ou livros."
          value={text}
          maxLength={MAX_TEXTO}
          onChange={onTextChange}
          onKeyDown={(e) => { if (e.key === "Escape") setMention(null); }}
          rows={3}
          className="min-h-24 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)]"
        />

        {mention && suggestions.length > 0 && (
          <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
            {suggestions.map((s) => (
              <button
                key={`${s.tipo}-${s.id}`}
                type="button"
                onClick={() => aplicarSugestao(s)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--hover-overlay)]"
              >
                {s.tipo === "livro" ? (
                  <div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[var(--hover-overlay)]">
                    {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                ) : (
                  <Avatar src={s.image} fallback={(s.rotulo || "?").charAt(0)} className="size-9" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{s.rotulo}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    <span className="mr-1 rounded bg-[var(--hover-overlay)] px-1 py-0.5 text-[10px] uppercase tracking-wide">{s.tipo}</span>
                    {s.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chips compactos de pessoas/autores mencionados — pequenos, com foto. */}
      {mentionedChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mentionedChips.map((chip) => (
            <span key={`${chip.tipo}-${chip.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] py-0.5 pl-0.5 pr-2.5 text-xs text-[var(--text-secondary)]">
              <Avatar src={chip.image} fallback={(chip.rotulo || "?").charAt(0)} className="size-6" />
              {chip.rotulo}
            </span>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <div key={index} className="relative h-32 w-48 shrink-0 snap-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)]">
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

      {/* Livro anexado: chip compacto com a capa. */}
      {selectedBook && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)] p-2.5">
          <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--bg-card)]">
            {selectedBook.image ? <img src={selectedBook.image} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{selectedBook.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{selectedBook.authorName || selectedBook.author}</p>
          </div>
          <button type="button" onClick={() => setBookId(null)} className="rounded-full p-1.5 text-[var(--text-muted)] hover:text-red-400" aria-label="Remover livro">
            <X className="size-4" />
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            aria-label="Adicionar imagem"
          >
            <Image className="size-4" /> <span className="hidden sm:inline">Imagem</span>
          </button>
          <button
            type="button"
            onClick={() => { setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@`); setMention({ query: "", start: text.length, end: text.length + 1 }); textareaRef.current?.focus(); }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            aria-label="Marcar alguém"
          >
            <UserRound className="size-4" /> <span className="hidden sm:inline">Marcar</span>
          </button>
          <span className="hidden items-center gap-1 text-xs text-[var(--text-muted)] sm:flex">
            <BookOpen className="size-3.5" /> digite @ para livros
          </span>
        </div>
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
