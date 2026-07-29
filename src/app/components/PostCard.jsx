import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Share2, Trash2 } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { canUsePaidSocialFeatures } from "@/lib/entitlements";
import { handleDoPerfil } from "@/lib/mentions";
import { isVerifiedProfile, relativeTime } from "@/lib/social";
import { EmojiReactions } from "./EmojiReactions";
import { PostPoll } from "./PostPoll";
import { RichText } from "./RichText";
import { SubscribeModal } from "./SubscribeModal";
import { UserTitlePill } from "./UserTitlePill";
import { VerifiedBadge } from "./VerifiedBadge";

function Avatar({ src, fallback, className = "size-11" }) {
  const [broken, setBroken] = useState(false);
  const isImage = !broken && (src?.startsWith?.("data:") || src?.startsWith?.("http") || src?.startsWith?.("/"));

  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]`}>
      {isImage ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : <div className="flex h-full w-full items-center justify-center">{fallback || "L"}</div>}
    </div>
  );
}

function ImageGallery({ images }) {
  if (!images?.length) return null;
  if (images.length === 1) {
    return (
      <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)]">
        <img src={images[0]} alt="" loading="lazy" className="max-h-[520px] w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
      {images.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          loading="lazy"
          className="h-64 w-[84%] shrink-0 snap-center rounded-[10px] border border-[var(--border)] object-cover sm:w-[68%]"
        />
      ))}
    </div>
  );
}

function CommentItem({ item, canDelete, onDelete, onReply }) {
  const { profiles } = useData();
  const profile = profiles.find((entry) => entry.id === item.user_id);
  const name = profile?.name || "Leitor";

  return (
    <div className={`rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3 ${item.parent_id ? "ml-5 sm:ml-8" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
          <Link to={`/app/perfil/${item.user_id}`} className="font-medium text-[var(--text-primary)] hover:underline">
            {name}
          </Link>
          {isVerifiedProfile(profile) && <VerifiedBadge className="size-3.5 text-[#3b82f6]" />}
          <span className="text-[var(--text-muted)]">@{handleDoPerfil(profile)}</span>
          <span className="text-[var(--text-muted)]">· {relativeTime(item.created_at)}</span>
        </div>
        {canDelete && (
          <button type="button" onClick={() => onDelete(item.id)} className="shrink-0 text-[var(--text-muted)] hover:text-red-400" aria-label="Apagar comentario">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <RichText text={item.text} className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]" />
      <div className="mt-2">
        <EmojiReactions targetType="post_reply" targetId={item.id} />
      </div>
      <button type="button" onClick={() => onReply(item, profile)} className="mt-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        Responder
      </button>
    </div>
  );
}

export function PostCard({ post, onDelete, reacoesIniciais = null, expanded = false }) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { profiles, savedPostIds, toggleSavedPost, subscription } = useData();
  const [liked, setLiked] = useState(Boolean(post.likedByMe));
  const [likes, setLikes] = useState(post.likes || 0);
  const [showComment, setShowComment] = useState(expanded);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const authorProfile = post.authorProfile || profiles.find((profile) => profile.id === post.user_id);
  const handle = post.handle || handleDoPerfil(authorProfile);
  const canDelete = isAdmin || post.user_id === user?.id;
  const saved = savedPostIds.includes(post.id);
  const replyCount = commentsLoaded ? comments.length : (post.replies || 0);
  const postUrl = `/app/post/${post.id}`;
  const canComment = canUsePaidSocialFeatures({ isAdmin, subscription });

  useEffect(() => {
    setLiked(Boolean(post.likedByMe));
    setLikes(post.likes || 0);
  }, [post.likedByMe, post.likes]);

  useEffect(() => {
    let active = true;
    if (!showComment || commentsLoaded || !isSupabaseReady()) return undefined;
    supabase
      .from("post_replies")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active || error) return;
        setComments(data || []);
        setCommentsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [showComment, commentsLoaded, post.id]);

  async function toggleLike() {
    if (!user?.id || busy) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes((count) => Math.max(0, count + (nextLiked ? 1 : -1)));

    if (!isSupabaseReady()) return;
    setBusy(true);
    try {
      if (nextLiked) {
        const { error } = await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
      setLikes((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!canComment) {
      setSubscribeOpen(true);
      return;
    }
    const text = comment.trim();
    if (!text || !user?.id || busy) return;
    setComment("");

    if (!isSupabaseReady()) return;
    const { data, error } = await supabase.from("post_replies").insert({
      post_id: post.id,
      user_id: user.id,
      text,
      parent_id: replyingTo?.id || null,
    }).select().single();
    if (error) {
      setComment(text);
      return;
    }
    setComments((current) => [...current, data]);
    setCommentsLoaded(true);
    setShowComment(true);
    setReplyingTo(null);
  }

  async function deleteComment(id) {
    const previous = comments;
    setComments((current) => current.filter((item) => item.id !== id));
    const { error } = await supabase.from("post_replies").delete().eq("id", id);
    if (error) setComments(previous);
  }

  async function handleDelete() {
    if (!canDelete || !onDelete) return;
    setDeleteError("");
    setBusy(true);
    try {
      await onDelete(post.id);
      setMenuOpen(false);
    } catch (err) {
      setDeleteError(err?.message || "Nao foi possivel apagar este post.");
    } finally {
      setBusy(false);
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}${postUrl}`;
    try {
      if (navigator.share) await navigator.share({ title: "OPE Club", text: post.text, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Compartilhamento cancelado pelo usuario.
    }
  }

  function openPost(event) {
    if (event.target.closest("a,button,input,textarea")) return;
    navigate(postUrl);
  }

  return (
    <article
      onClick={openPost}
      className="relative flex h-fit w-full min-w-0 cursor-pointer flex-col gap-4 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--border-strong)] sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to={`/app/perfil/${post.user_id}`} className="shrink-0">
            <Avatar src={post.avatar} fallback={post.author?.charAt(0)} />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
              <Link to={`/app/perfil/${post.user_id}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
                {post.author || "Leitor"}
              </Link>
              {(post.verified || isVerifiedProfile(authorProfile)) && <VerifiedBadge />}
              <UserTitlePill userId={post.user_id} />
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="truncate">@{handle}</span>
              <span>·</span>
              <Link to={postUrl} className="hover:underline">{relativeTime(post.created_at)}</Link>
            </div>
          </div>
        </div>

        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]" aria-label="Opcoes do post">
            <MoreHorizontal className="size-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,.24)]">
              {canDelete ? (
                <button type="button" onClick={handleDelete} disabled={busy} className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                  <Trash2 className="size-4" />
                  Apagar
                </button>
              ) : (
                <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Sem acoes disponiveis</p>
              )}
            </div>
          )}
        </div>
      </header>

      <RichText text={post.text} className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--text-primary)]" />
      <ImageGallery images={post.images || []} />

      {post.book && (
        <Link to={`/app/livro/${post.book.id}`} className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3 hover:bg-[var(--bg-card-hover)]">
          <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--bg-card)] shadow-sm">{post.book.image ? <img src={post.book.image} alt={post.book.title} className="h-full w-full object-cover" /> : null}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{post.book.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{post.book.author}</p>
          </div>
        </Link>
      )}

      <PostPoll poll={post.poll} />
      <EmojiReactions targetType="post" targetId={post.id} reacoesIniciais={reacoesIniciais} />

      <footer className="flex items-center justify-between border-t border-[var(--border)] pt-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={toggleLike} disabled={busy} className={`flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs transition-all sm:px-3 ${liked ? "bg-[#c78359]/10 text-[#c78359]" : "text-[var(--text-muted)] hover:bg-[#c78359]/10 hover:text-[#c78359]"}`}>
            <Heart className="size-[18px]" fill={liked ? "currentColor" : "none"} strokeWidth={1.5} />
            <span>{likes}</span>
          </button>
          <button type="button" onClick={() => canComment ? setShowComment((value) => !value) : setSubscribeOpen(true)} className="flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:px-3">
            <MessageCircle className="size-[18px]" strokeWidth={1.5} />
            <span>{replyCount}</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={() => toggleSavedPost(post.id).catch(() => {})} className={`flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs transition-all sm:px-3 ${saved ? "bg-[#c78359]/10 text-[#c78359]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"}`} aria-label={saved ? "Remover dos salvos" : "Salvar post"}>
            <Bookmark className="size-[18px]" fill={saved ? "currentColor" : "none"} strokeWidth={1.5} />
            <span className="hidden sm:inline">{saved ? "Salvo" : "Salvar"}</span>
          </button>
          <button type="button" onClick={sharePost} className="flex min-h-10 items-center rounded-full px-2 text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] sm:px-3" aria-label="Compartilhar">
            <Share2 className="size-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {showComment && (
        <div className="space-y-3">
          {replyingTo && (
            <div className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--hover-overlay)] px-3 py-2 text-xs text-[var(--text-muted)]">
              <span>Respondendo comentario</span>
              <button type="button" onClick={() => { setReplyingTo(null); setComment(""); }} className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Cancelar
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComment(); }} placeholder="Escreva um comentario... use @ para marcar" className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]" />
            <button type="button" onClick={submitComment} disabled={!comment.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] disabled:opacity-40" aria-label="Enviar comentario">
              <Send className="size-4" />
            </button>
          </div>

          {comments.map((item) => (
            <CommentItem
              key={item.id}
              item={item}
              canDelete={isAdmin || item.user_id === user?.id}
              onDelete={deleteComment}
              onReply={(reply, profile) => {
                if (!canComment) {
                  setSubscribeOpen(true);
                  return;
                }
                setReplyingTo(reply);
                setComment(`@${handleDoPerfil(profile)} `);
              }}
            />
          ))}
        </div>
      )}
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
      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
    </article>
  );
}
