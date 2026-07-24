import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Share2, Trash2 } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { EmojiReactions } from "./EmojiReactions";
import { RichText } from "./RichText";
import { UserTitlePill } from "./UserTitlePill";

function Avatar({ src, fallback }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http"));

  return (
    <div className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]">
      {isImage ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback || "L"}</div>
      )}
    </div>
  );
}

function tempoRelativo(iso) {
  if (!iso) return "agora";
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h`;
  const dias = Math.floor(minutos / 1440);
  if (dias < 30) return `${dias} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function PostCard({ post, onDelete, reacoesIniciais = null }) {
  const { user, isAdmin } = useAuth();
  const { profiles, savedPostIds, toggleSavedPost } = useData();
  const images = post.images || (post.image ? [post.image] : []);
  const [liked, setLiked] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [comentariosCarregados, setComentariosCarregados] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const likeCount = (post.likes || 0) + (liked ? 1 : 0);
  const replyCount = comentariosCarregados ? comments.length : (post.replies || 0);
  const handle = post.handle || "leitor";
  const canDelete = isAdmin || post.user_id === user?.id;
  const saved = savedPostIds.includes(post.id);

  // Carrega as respostas so quando o usuario abre a secao: o feed inteiro nao
  // precisa puxar comentario de todo post na primeira renderizacao.
  useEffect(() => {
    let ativo = true;
    if (!showComment || comentariosCarregados || !isSupabaseReady()) return undefined;

    supabase
      .from("post_replies")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setComments(data || []);
        setComentariosCarregados(true);
      });

    return () => {
      ativo = false;
    };
  }, [showComment, comentariosCarregados, post.id]);

  async function toggleLike() {
    if (!user?.id || busy) return;
    const nextLiked = !liked;
    setLiked(nextLiked);

    if (!isSupabaseReady()) return;
    setBusy(true);
    try {
      if (nextLiked) {
        const { error } = await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", post.id);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    const texto = comment.trim();
    if (!texto || !user?.id) return;
    setComment("");

    if (!isSupabaseReady()) return;
    const { data, error } = await supabase
      .from("post_replies")
      .insert({ post_id: post.id, user_id: user.id, text: texto })
      .select()
      .single();

    if (error) {
      setComment(texto);
      return;
    }
    setComments((atual) => [...atual, data]);
    setComentariosCarregados(true);
  }

  async function apagarComentario(id) {
    const anterior = comments;
    setComments((atual) => atual.filter((item) => item.id !== id));
    const { error } = await supabase.from("post_replies").delete().eq("id", id);
    if (error) setComments(anterior);
  }

  async function handleDelete() {
    if (!canDelete || !onDelete) return;
    setDeleteError("");
    setBusy(true);
    try {
      await onDelete(post.id);
      setMenuOpen(false);
    } catch (err) {
      setDeleteError(err?.message || "Não foi possível apagar este post.");
    } finally {
      setBusy(false);
    }
  }

  async function compartilhar() {
    const url = `${window.location.origin}/app/comunidade`;
    try {
      if (navigator.share) await navigator.share({ title: "OPE Club", text: post.text, url });
      else await navigator.clipboard.writeText(`${post.text}\n${url}`);
    } catch {
      // Usuario cancelou o compartilhamento: nada a fazer.
    }
  }

  return (
    <article className="relative flex h-fit w-full flex-col gap-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-strong)] sm:p-5">
      <header className="flex flex-row items-start justify-between tracking-normal">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/app/perfil/${post.user_id}`}>
            <Avatar src={post.avatar} fallback={post.author?.charAt(0)} />
          </Link>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to={`/app/perfil/${post.user_id}`}
                className="truncate text-sm font-medium text-[var(--text-primary)] hover:underline"
              >
                {post.author || "Leitor"}
              </Link>
              <UserTitlePill userId={post.user_id} />
              {post.tag && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {post.tag}
                </span>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="truncate">@{handle}</span>
              <span>·</span>
              <span>{tempoRelativo(post.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-all hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            aria-label="Abrir opções do post"
          >
            <MoreHorizontal className="size-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,.24)]">
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  Apagar
                </button>
              ) : (
                <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Sem ações disponíveis</p>
              )}
            </div>
          )}
        </div>
      </header>

      <RichText
        text={post.text}
        className="whitespace-pre-wrap break-words text-[15px] font-normal leading-relaxed tracking-normal text-[var(--text-primary)]"
      />

      {images.length > 0 && <ImageGallery images={images} />}

      {post.book && (
        <Link
          to={`/app/livro/${post.book.id}`}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)] p-3 transition-colors hover:bg-[var(--bg-card-hover)]"
        >
          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--bg-card)] shadow-sm">
            {post.book.image ? <img src={post.book.image} alt={post.book.title} className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{post.book.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{post.book.author}</p>
          </div>
        </Link>
      )}

      <EmojiReactions targetType="post" targetId={post.id} reacoesIniciais={reacoesIniciais} />

      <footer className="flex items-center justify-between border-t border-[var(--border)] pt-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-all sm:px-3 ${
              liked ? "bg-[#c78359]/10 text-[#c78359]" : "text-[var(--text-muted)] hover:bg-[#c78359]/10 hover:text-[#c78359]"
            }`}
          >
            <Heart className="size-[18px]" fill={liked ? "currentColor" : "none"} strokeWidth={1.5} />
            <span>{likeCount}</span>
          </button>
          <button
            onClick={() => setShowComment((value) => !value)}
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:px-3"
          >
            <MessageCircle className="size-[18px]" strokeWidth={1.5} />
            <span>{replyCount}</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => toggleSavedPost(post.id).catch(() => {})}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-all sm:px-3 ${
              saved ? "bg-[#c78359]/10 text-[#c78359]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            }`}
            aria-label={saved ? "Remover dos salvos" : "Salvar post"}
          >
            <Bookmark className="size-[18px]" fill={saved ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
          <button
            onClick={compartilhar}
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-[var(--text-muted)] transition-all hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:px-3"
            aria-label="Compartilhar"
          >
            <Share2 className="size-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {showComment && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] p-2">
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitComment();
              }}
              placeholder="Escreva um comentário... use @ para marcar alguém"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
            />
            <button
              onClick={submitComment}
              disabled={!comment.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] disabled:opacity-40"
              aria-label="Enviar comentário"
            >
              <Send className="size-4" />
            </button>
          </div>

          {comments.map((item) => {
            const perfil = profiles.find((p) => p.id === item.user_id);
            const nome = perfil?.name || "Leitor";
            const podeApagar = isAdmin || item.user_id === user?.id;

            return (
              <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
                    <Link to={`/app/perfil/${item.user_id}`} className="font-medium text-[var(--text-primary)] hover:underline">
                      {nome}
                    </Link>
                    <UserTitlePill userId={item.user_id} />
                    <span className="text-[var(--text-muted)]">@{handleDoPerfil(perfil)}</span>
                    <span className="text-[var(--text-muted)]">· {tempoRelativo(item.created_at)}</span>
                  </div>
                  {podeApagar && (
                    <button
                      onClick={() => apagarComentario(item.id)}
                      className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-red-400"
                      aria-label="Apagar comentário"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <RichText
                  text={item.text}
                  className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]"
                />
                <div className="mt-2">
                  <EmojiReactions targetType="post_reply" targetId={item.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
    </article>
  );
}

function ImageGallery({ images }) {
  if (images.length === 1) {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--border)] shadow-sm">
        <img src={images[0]} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
      {images.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          loading="lazy"
          className="h-64 w-5/6 shrink-0 snap-center snap-always rounded-xl border border-[var(--border)] object-cover shadow-sm sm:w-[72%]"
        />
      ))}
    </div>
  );
}
