import { useMemo, useRef, useState } from "react";
import { BarChart3, Image, Plus, Send, UserRound, X } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { useRewards } from "@/app/data/RewardsContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { canUsePaidSocialFeatures } from "@/lib/entitlements";
import { handleDoPerfil, normalizar, resolverMencao, tokenizarMencoes } from "@/lib/mentions";
import {
  MAX_POST_IMAGES,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_TEXT,
  POST_IMAGE_BUCKET,
  sanitizePollOptions,
} from "@/lib/social";
import { SubscribeModal } from "./SubscribeModal";
import { VerifiedBadge } from "./VerifiedBadge";
import { sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize";
import { secureUpload } from "@/lib/secure-upload";

const ALLOWED_POST_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function Avatar({ src, fallback, className = "size-11" }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http") || src?.startsWith?.("/"));
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]`}>
      {isImage ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : <div className="flex h-full w-full items-center justify-center">{fallback}</div>}
    </div>
  );
}

async function uploadPostImages(files) {
  if (!files.length) return [];
  if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");

  const uploaded = [];
  for (const file of files) {
    if (!ALLOWED_POST_IMAGE_TYPES.has(file.type)) {
      throw new Error("Use imagens JPG, PNG, WebP ou GIF.");
    }
    if (file.size > MAX_POST_IMAGE_BYTES) throw new Error("Cada imagem precisa ter no maximo 5 MB.");
    uploaded.push(await secureUpload({
      file,
      bucket: POST_IMAGE_BUCKET,
      kind: "post-image",
    }));
  }
  return uploaded;
}

export function CreatePost({ initialBookId = null, tag = null }) {
  const { user, profile, isAdmin } = useAuth();
  const { addPost, books, authors, profiles, subscription } = useData();
  const { rewardPost } = useRewards();
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [text, setText] = useState("");
  const [bookId, setBookId] = useState(initialBookId);
  const [imageFiles, setImageFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [mention, setMention] = useState(null);

  const name = profile?.name || user?.user_metadata?.name || "Voce";
  const handle = handleDoPerfil(profile);
  const avatar = profile?.avatar || user?.user_metadata?.avatar_url;
  const initial = name.charAt(0).toUpperCase();
  const selectedBook = books.find((book) => book.id === bookId);
  const canPublish = canUsePaidSocialFeatures({ isAdmin, subscription });

  const mentionedChips = useMemo(() => {
    const seen = new Set();
    const chips = [];
    for (const part of tokenizarMencoes(text)) {
      if (part.tipo !== "mencao") continue;
      const target = resolverMencao(part.valor, { profiles, authors, books });
      if (!target || seen.has(`${target.tipo}-${target.id}`)) continue;
      seen.add(`${target.tipo}-${target.id}`);
      const record = target.tipo === "perfil"
        ? profiles.find((item) => item.id === target.id)
        : target.tipo === "autor"
          ? authors.find((item) => item.id === target.id)
          : books.find((item) => item.id === target.id);
      chips.push({ ...target, image: target.tipo === "livro" ? record?.image : record?.avatar || record?.image });
    }
    return chips;
  }, [text, profiles, authors, books]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = normalizar(mention.query);
    const matches = (value) => !query || normalizar(value).includes(query);
    const people = profiles
      .filter((item) => item.id !== user?.id && (matches(item.name) || matches(item.username)))
      .slice(0, 4)
      .map((item) => ({ type: "pessoa", id: item.id, label: item.name || "Leitor", sub: `@${handleDoPerfil(item)}`, image: item.avatar, insert: `@${handleDoPerfil(item)}` }));
    const authorList = authors
      .filter((item) => matches(item.name))
      .slice(0, 4)
      .map((item) => ({ type: "autor", id: item.id, label: item.name, sub: "Autor", image: item.image, insert: `@${(item.name || "").replace(/\s+/g, "")}` }));
    const bookList = books
      .filter((item) => matches(item.title))
      .slice(0, 4)
      .map((item) => ({ type: "livro", id: item.id, label: item.title, sub: item.authorName || item.author || "Livro", image: item.image, insert: `@${(item.title || "").replace(/\s+/g, "")}` }));
    return [...people, ...authorList, ...bookList].slice(0, 8);
  }, [mention, profiles, authors, books, user?.id]);

  function resetComposer() {
    setText("");
    setBookId(null);
    previews.forEach((src) => URL.revokeObjectURL(src));
    setImageFiles([]);
    setPreviews([]);
    setPollEnabled(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setMention(null);
    setError("");
  }

  function onTextChange(event) {
    const value = event.target.value.slice(0, MAX_POST_TEXT);
    setText(value);
    const caret = event.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = before.match(/(^|\s)@([\p{L}0-9_]*)$/u);
    setMention(match ? { query: match[2], start: caret - match[2].length - 1, end: caret } : null);
  }

  function applySuggestion(suggestion) {
    if (suggestion.type === "livro") setBookId(suggestion.id);
    const insertText = suggestion.insert || `@${suggestion.label.replace(/\s+/g, "")}`;
    const { start, end } = mention;
    const next = `${text.slice(0, start)}${insertText} ${text.slice(end)}`.slice(0, MAX_POST_TEXT);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      const position = start + insertText.length + 1;
      element.focus();
      element.setSelectionRange(position, position);
    });
  }

  function handleImageSelect(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const valid = files.filter((file) =>
      ALLOWED_POST_IMAGE_TYPES.has(file.type) && file.size <= MAX_POST_IMAGE_BYTES
    );
    if (valid.length !== files.length) {
      setError("Algumas imagens foram ignoradas. Use JPG, PNG, WebP ou GIF de ate 5 MB.");
    }
    setImageFiles((current) => {
      const room = MAX_POST_IMAGES - current.length;
      if (room <= 0) return current;
      const picked = valid.slice(0, room);
      setPreviews((prev) => [...prev, ...picked.map((file) => URL.createObjectURL(file))]);
      return [...current, ...picked];
    });
  }

  function removeImage(index) {
    URL.revokeObjectURL(previews[index]);
    setImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit() {
    if (!canPublish) {
      setSubscribeOpen(true);
      return;
    }
    const cleanText = sanitizePlainText(text, MAX_POST_TEXT);
    const cleanPollQuestion = sanitizeSingleLine(pollQuestion, 240);
    const cleanPollOptions = sanitizePollOptions(pollOptions);
    if ((!cleanText && imageFiles.length === 0 && !pollEnabled) || publishing) return;
    if (pollEnabled && (!cleanPollQuestion || cleanPollOptions.length < 2)) {
      setError("A enquete precisa de pergunta e pelo menos 2 opcoes.");
      return;
    }

    setPublishing(true);
    setError("");
    let uploadedPaths = [];
    try {
      uploadedPaths = await uploadPostImages(imageFiles);
      await addPost({
        userId: user?.id,
        text: cleanText || cleanPollQuestion,
        tag,
        bookId,
        imagePaths: uploadedPaths,
        poll: pollEnabled ? { question: cleanPollQuestion, options: cleanPollOptions } : null,
        author: name,
        avatar: avatar || initial,
      });
      resetComposer();
      setOpen(false);
      if (user?.id && rewardPost) rewardPost(user.id, "community").catch(() => {});
    } catch (err) {
      if (uploadedPaths.length) {
        await supabase.storage.from(POST_IMAGE_BUCKET).remove(uploadedPaths).catch(() => {});
      }
      setError(err?.message || "Nao foi possivel publicar.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => canPublish ? setOpen(true) : setSubscribeOpen(true)}
        className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)]"
      >
        <Plus className="size-4" />
        Criar post
      </button>

      <SubscribeModal
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        title="Membros pagantes"
        description="Postar, comentar e responder sao recursos exclusivos de quem assina o OPE Club. Voce pode continuar lendo e curtindo tudo de graca."
        benefits={[
          "Publicar posts na comunidade",
          "Comentar e responder conversas",
          "Participar dos clubes de leitura",
          "Acessar a biblioteca completa",
          "Receber lancamentos semanais",
        ]}
      />

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-150">
          <div className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[14px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[14px]">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 shrink-0">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={avatar} fallback={initial} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                    {(profile?.verified || profile?.is_verified || profile?.role === "admin") && <VerifiedBadge />}
                  </div>
                  <p className="truncate text-xs text-[var(--text-muted)]">@{handle}</p>
                </div>
              </div>
              <button type="button" onClick={() => { resetComposer(); setOpen(false); }} className="flex size-9 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]">
                <X className="size-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  placeholder="Compartilhe uma ideia, trecho, pergunta ou provocacao. Use @ para marcar pessoas, autores e livros."
                  value={text}
                  maxLength={MAX_POST_TEXT}
                  onChange={onTextChange}
                  onKeyDown={(event) => { if (event.key === "Escape") setMention(null); }}
                  rows={5}
                  className="min-h-32 w-full resize-none rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)]"
                />

                {mention && suggestions.length > 0 && (
                  <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-sm)]">
                    {suggestions.map((item) => (
                      <button key={`${item.type}-${item.id}`} type="button" onClick={() => applySuggestion(item)} className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left hover:bg-[var(--hover-overlay)]">
                        {item.type === "livro" ? (
                          <div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[var(--hover-overlay)]">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : null}</div>
                        ) : (
                          <Avatar src={item.image} fallback={(item.label || "?").charAt(0)} className="size-9" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                          <p className="truncate text-xs text-[var(--text-muted)]">{item.type} · {item.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {mentionedChips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {mentionedChips.map((chip) => (
                    <span key={`${chip.tipo}-${chip.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] py-0.5 pl-0.5 pr-2.5 text-xs text-[var(--text-secondary)]">
                      <Avatar src={chip.image} fallback={(chip.rotulo || "?").charAt(0)} className="size-6" />
                      <span className="truncate">{chip.rotulo}</span>
                    </span>
                  ))}
                </div>
              )}

              {previews.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {previews.map((src, index) => (
                    <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)]">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-white">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedBook && (
                <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-2.5">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--bg-card)]">{selectedBook.image ? <img src={selectedBook.image} alt="" className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{selectedBook.title}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{selectedBook.authorName || selectedBook.author}</p>
                  </div>
                  <button type="button" onClick={() => setBookId(null)} className="rounded-full p-1.5 text-[var(--text-muted)] hover:text-red-400">
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {pollEnabled && (
                <div className="mt-4 space-y-3 rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3">
                  <input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Pergunta da enquete" className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none" />
                  {pollOptions.map((option, index) => (
                    <input key={index} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Opcao ${index + 1}`} className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none" />
                  ))}
                  <div className="flex gap-2">
                    <button type="button" disabled={pollOptions.length >= 4} onClick={() => setPollOptions((current) => [...current, ""])} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] disabled:opacity-40">Adicionar opcao</button>
                    <button type="button" onClick={() => setPollEnabled(false)} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-red-400">Remover enquete</button>
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shrink-0">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
              <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]">
                  <Image className="size-4" /> <span className="hidden sm:inline">Imagem</span>
                </button>
                <button type="button" onClick={() => { setText((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@`); setMention({ query: "", start: text.length, end: text.length + 1 }); textareaRef.current?.focus(); }} className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]">
                  <UserRound className="size-4" /> <span className="hidden sm:inline">Marcar</span>
                </button>
                <button type="button" onClick={() => setPollEnabled((value) => !value)} className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]">
                  <BarChart3 className="size-4" /> <span className="hidden sm:inline">Enquete</span>
                </button>
              </div>
              <button
                type="button"
                disabled={publishing || (!text.trim() && !imageFiles.length && !pollEnabled)}
                onClick={handleSubmit}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="size-3.5" />
                {publishing ? "Publicando..." : "Publicar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
