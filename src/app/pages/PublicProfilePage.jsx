import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark as BookmarkIcon, ChatCircle, MoreHorizontal, Share2 } from "@/lib/icons";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { FollowButton } from "../components/FollowButton";
import { CollectionsPanel } from "../components/CollectionsPanel";
import { PostCard } from "../components/PostCard";
import { handleDoPerfil } from "@/lib/mentions";
import { toast } from "@/lib/toast";

function Avatar({ src, fallback, size = "lg" }) {
  const [quebrada, setQuebrada] = useState(false);
  const ehImagem = !quebrada && (src?.startsWith?.("http") || src?.startsWith?.("data:"));
  const sizeCls = size === "lg" ? "size-[88px] sm:size-[112px]" : "size-10";
  const textCls = size === "lg" ? "text-3xl" : "text-sm";
  return (
    <div className={`${sizeCls} shrink-0 overflow-hidden rounded-full border-4 border-[var(--bg-canvas)] bg-[var(--hover-overlay)] text-[var(--text-primary)] ${textCls} font-bold`}>
      {ehImagem ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setQuebrada(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      )}
    </div>
  );
}

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "colecoes", label: "Colecoes" },
  { id: "salvos", label: "Salvos" },
];

export function PublicProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profiles, posts, deletePost, followerCounts, followingCounts,
  } = useData();
  const [aba, setAba] = useState("posts");
  const [menuOpen, setMenuOpen] = useState(false);

  const perfil = profiles.find((item) => item.id === id);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onClick(e) { if (!e.target.closest("[data-profile-menu]")) setMenuOpen(false); }
    function onKey(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!perfil) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[var(--text-muted)]">Perfil nao encontrado ou marcado como privado.</p>
        <Link to="/app/inicio" className="mt-4 inline-block text-sm text-[var(--text-primary)] hover:underline">
          Voltar para a comunidade
        </Link>
      </div>
    );
  }

  const nome = perfil.name || "Leitor";
  const handle = handleDoPerfil(perfil);
  const avatar = perfil.avatar_url || perfil.avatar;
  const capa = perfil.cover_url || perfil.cover || null;
  const bio = perfil.bio;
  const postsDoPerfil = posts.filter((post) => post.user_id === perfil.id);
  const totalPosts = postsDoPerfil.length;
  const totalSeguidores = followerCounts[perfil.id] || 0;
  const totalSeguindo = followingCounts[perfil.id] || 0;
  const ehProprio = user?.id === perfil.id;
  const profileUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleShare() {
    try {
      if (navigator.share) await navigator.share({ title: nome, url: profileUrl });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(profileUrl); toast.success("Link copiado."); }
    } catch { /* cancelado */ }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    } finally {
      setMenuOpen(false);
    }
  }

  function handleReport() {
    setMenuOpen(false);
    toast.info("Denuncia registrada. Vamos analisar.");
  }

  return (
    <div className="-mx-4 sm:mx-0 sm:max-w-[640px] md:mx-auto md:max-w-[720px]">
      {/* Top bar (igual a referencia) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-canvas)]/80 px-4 py-2.5 backdrop-blur sm:px-0">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[var(--text-primary)]">{nome}</h1>
            <p className="truncate text-xs text-[var(--text-muted)]">{totalPosts} {totalPosts === 1 ? "post" : "posts"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            aria-label="Compartilhar perfil"
          >
            <Share2 className="size-4" />
          </button>
          <div className="relative" data-profile-menu>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
              aria-label="Mais opcoes"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="size-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
                <button onClick={handleCopyLink} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--hover-overlay)]">Copiar link</button>
                <button onClick={handleReport} className="block w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[var(--hover-overlay)]">Denunciar perfil</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Capa */}
      <div className="relative h-32 overflow-hidden bg-[var(--hover-overlay)] sm:h-44">
        {capa ? <img src={capa} alt="" className="h-full w-full object-cover" /> : null}
      </div>

      {/* Avatar + acoes */}
      <section className="px-4 sm:px-0">
        <div className="flex items-end justify-between -mt-[44px] sm:-mt-[56px]">
          <Avatar src={avatar} fallback={nome.charAt(0).toUpperCase()} size="lg" />
          <div className="flex items-center gap-2 pb-2">
            {ehProprio ? (
              <Link
                to="/app/configuracoes?aba=perfil"
                className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
              >
                Editar perfil
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
                  aria-label="Mensagem"
                >
                  <ChatCircle className="size-4" />
                </button>
                <FollowButton userId={perfil.id} />
              </>
            )}
          </div>
        </div>

        {/* Nome + handle */}
        <div className="mt-3">
          <h2 className="text-lg font-bold leading-tight text-[var(--text-primary)]">{nome}</h2>
          <p className="text-sm text-[var(--text-muted)]">@{handle}</p>
        </div>

        {/* Bio */}
        {bio ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-primary)]">
            {bio}
          </p>
        ) : null}

        {/* Stats inline (estilo X) */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
          <span><span className="font-semibold text-[var(--text-primary)]">{totalSeguindo.toLocaleString("pt-BR")}</span> Seguindo</span>
          <span><span className="font-semibold text-[var(--text-primary)]">{totalSeguidores.toLocaleString("pt-BR")}</span> Seguidores</span>
        </div>
      </section>

      {/* Tabs (estilo X: texto com underline) */}
      <div className="mt-4 flex border-b border-[var(--border)]">
        {TABS.map((tab) => {
          const active = aba === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`relative flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-secondary)]"
              }`}
              aria-pressed={active}
            >
              {tab.label}
              {active ? <span className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-[var(--accent-mint)]" /> : null}
            </button>
          );
        })}
      </div>

      {/* Conteudo das tabs */}
      <div className="px-4 pt-4 pb-24 sm:px-0 sm:pt-5">
        {aba === "posts" && (
          postsDoPerfil.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--border)] p-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">Nenhuma publicacao por aqui ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postsDoPerfil.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={deletePost}
                />
              ))}
            </div>
          )
        )}

        {aba === "colecoes" && (
          <CollectionsPanel
            ownerId={perfil.id}
            ownerName={nome}
            showCreateButton={ehProprio}
            createPrompt={!ehProprio ? "Voce so pode criar colecoes no seu proprio perfil." : undefined}
          />
        )}

        {aba === "salvos" && (
          ehProprio ? (
            <SalvosTab />
          ) : (
            <div className="rounded-[12px] border border-dashed border-[var(--border)] p-10 text-center">
              <BookmarkIcon className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Salvos sao privados.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Voce so ve os seus proprios posts salvos.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SalvosTab() {
  const { posts, deletePost, savedPostIds } = useData();
  const navigate = useNavigate();
  const salvos = useMemo(
    () => posts.filter((p) => savedPostIds.includes(p.id)),
    [posts, savedPostIds]
  );

  if (salvos.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[var(--border)] p-10 text-center">
        <BookmarkIcon className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Voce ainda nao salvou nenhum post.</p>
        <button
          onClick={() => navigate("/app/comunidade")}
          className="mt-3 rounded-full bg-[var(--text-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--bg-card)]"
        >
          Explorar comunidade
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {salvos.map((post) => (
        <PostCard key={post.id} post={post} onDelete={deletePost} />
      ))}
    </div>
  );
}
