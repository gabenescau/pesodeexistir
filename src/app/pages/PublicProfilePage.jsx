import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight, Bookmark as BookmarkIcon, Hash, LayoutGrid,
  Lock, MoreHorizontal, Share2,
} from "@/lib/icons";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { FollowButton } from "../components/FollowButton";
import { CollectionsPanel } from "../components/CollectionsPanel";
import { handleDoPerfil } from "@/lib/mentions";
import { toast } from "@/lib/toast";

function Avatar({ src, fallback, size = "lg" }) {
  const [quebrada, setQuebrada] = useState(false);
  const ehImagem = !quebrada && (src?.startsWith?.("http") || src?.startsWith?.("data:"));
  const sizeCls = size === "lg" ? "size-24 sm:size-28" : "size-10";
  const textCls = size === "lg" ? "text-3xl" : "text-sm";

  return (
    <div className={`${sizeCls} shrink-0 overflow-hidden rounded-full border-[3px] border-white/90 bg-white/10 text-white shadow-[var(--shadow-sm)] ${textCls} font-bold`}>
      {ehImagem ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setQuebrada(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      )}
    </div>
  );
}

function PostThumb({ post, onOpen }) {
  const cover = post.images?.[0];
  if (!cover) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-square w-full overflow-hidden rounded-[6px] border border-[var(--border)] bg-gradient-to-br from-[var(--bg-card)] to-[var(--hover-overlay)]"
      >
        <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] font-medium text-[var(--text-secondary)] line-clamp-3">
          {post.text || "Publicacao"}
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="relative block aspect-square w-full overflow-hidden rounded-[6px] bg-[var(--bg-card)]">
      <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}

const TABS = [
  { id: "posts", Icon: LayoutGrid },
  { id: "colecoes", Icon: Hash },
  { id: "salvos", Icon: BookmarkIcon },
];

export function PublicProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profiles, posts, followerCounts, followingCounts, books,
  } = useData();
  const [aba, setAba] = useState("posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const coverRef = useRef(null);

  // O proprio perfil tem edicao: manda para a tela completa.
  if (id === user?.id) return <Navigate to="/app/configuracoes?aba=perfil" replace />;

  const perfil = profiles.find((item) => item.id === id);

  // Fecha o menu "Mais" ao clicar fora / Esc.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
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
  const bio = perfil.bio;
  const postsDoPerfil = posts.filter((post) => post.user_id === perfil.id);
  const totalPosts = postsDoPerfil.length;
  const totalSeguidores = followerCounts[perfil.id] || 0;
  const totalSeguindo = followingCounts[perfil.id] || 0;

  // Categorias de interesse: top 4 categorias dos livros referenciados nos
  // posts do usuario. Cada chip usa a capa do primeiro livro dessa categoria.
  const interestChips = useMemo(() => {
    const byCategory = new Map();
    for (const post of postsDoPerfil) {
      const book = post.book;
      if (!book?.category) continue;
      const list = byCategory.get(book.category) || [];
      if (!list.find((b) => b.id === book.id)) list.push(book);
      byCategory.set(book.category, list);
    }
    return [...byCategory.entries()].slice(0, 4).map(([category, bookList]) => ({
      category,
      cover: bookList[0]?.image || "",
      label: category,
    }));
  }, [postsDoPerfil, books]);

  const profileUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleShare() {
    try {
      if (navigator.share) await navigator.share({ title: nome, url: profileUrl });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(profileUrl); toast.success("Link copiado."); }
    } catch {}
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

  function handleScrollTop() {
    coverRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="-mx-4 sm:mx-0">
      {/* COVER + PERFIL (igual a referencia) */}
      <section
        ref={coverRef}
        className="relative overflow-hidden bg-gradient-to-br from-[#0066cc] via-[#0071e3] to-[#2997ff] px-4 pb-3 pt-3 text-white sm:mx-0 sm:rounded-t-[16px]"
      >
        {/* Barra superior: titulo + 3 botoes redondos */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Profile</h1>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25" aria-label="Compartilhar perfil">
              <Share2 className="size-4 text-white" weight="bold" />
            </button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25" aria-label="Mais opcoes" aria-expanded={menuOpen}>
                <MoreHorizontal className="size-4 text-white" weight="bold" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
                  <button onClick={handleCopyLink} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--hover-overlay)]">Copiar link</button>
                  <button onClick={handleReport} className="block w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[var(--hover-overlay)]">Denunciar perfil</button>
                </div>
              ) : null}
            </div>
            <button onClick={handleScrollTop} className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25" aria-label="Topo do perfil">
              <ArrowUpRight className="size-4 text-white" weight="bold" />
            </button>
          </div>
        </div>

        {/* Avatar centralizado */}
        <div className="mt-6 flex flex-col items-center text-center">
          <Avatar src={avatar} fallback={nome.charAt(0).toUpperCase()} size="lg" />
          <h2 className="mt-3 text-lg font-bold leading-tight tracking-tight sm:text-xl">{nome}</h2>
          <p className="text-xs text-white/80 sm:text-sm">@{handle}</p>

          {/* Estatisticas: Publicacoes / Seguidores / Seguindo */}
          <div className="mt-4 grid w-full max-w-sm grid-cols-3 divide-x divide-white/20">
            <div className="px-2">
              <p className="text-base font-bold leading-none sm:text-lg">{totalPosts}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/75 sm:text-[11px]">Publicacoes</p>
            </div>
            <div className="px-2">
              <p className="text-base font-bold leading-none sm:text-lg">{totalSeguidores.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/75 sm:text-[11px]">Seguidores</p>
            </div>
            <div className="px-2">
              <p className="text-base font-bold leading-none sm:text-lg">{totalSeguindo.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/75 sm:text-[11px]">Seguindo</p>
            </div>
          </div>

          {/* Bio */}
          {bio ? (
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-white/90 sm:text-sm">
              {bio}
            </p>
          ) : null}

          {/* Categorias de interesse (chips circulares) */}
          {interestChips.length > 0 ? (
            <div className="mt-4 flex w-full max-w-md justify-center gap-4 overflow-x-auto pb-1 sm:gap-5" style={{ scrollbarWidth: "none" }}>
              {interestChips.map((chip) => (
                <div key={chip.category} className="flex w-[64px] shrink-0 flex-col items-center text-center sm:w-[72px]">
                  <div className="size-16 overflow-hidden rounded-full border-2 border-white/80 bg-white/15 shadow-[var(--shadow-sm)] sm:size-[72px]">
                    {chip.cover ? (
                      <img src={chip.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/80">
                        {chip.label.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[10px] font-medium text-white/90 sm:text-[11px]">{chip.label}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Acao de seguir (compacta, abaixo dos chips) */}
          {user?.id && user.id !== perfil.id ? (
            <div className="mt-4">
              <FollowButton userId={perfil.id} />
            </div>
          ) : null}
        </div>

        {/* Tabs (3 icones) */}
        <div className="mt-4 flex items-center justify-center gap-8 border-t border-white/20 pt-3">
          {TABS.map(({ id: tabId, Icon }) => {
            const active = aba === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setAba(tabId)}
                className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-white/25" : "hover:bg-white/10"
                }`}
                aria-label={tabId}
                aria-pressed={active}
              >
                <Icon className={`size-5 ${active ? "text-white" : "text-white/70"}`} weight={active ? "fill" : "regular"} />
              </button>
            );
          })}
        </div>
      </section>

      {/* CONTEUDO DAS TABS */}
      <div className="px-4 pt-4 pb-24 sm:px-0 sm:pt-5">
        {aba === "posts" && (
          postsDoPerfil.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--border)] p-10 text-center">
              <LayoutGrid className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">Nenhuma publicacao por aqui ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[2px] sm:gap-1">
              {postsDoPerfil.map((post) => (
                <PostThumb key={post.id} post={post} onOpen={() => navigate(`/app/post/${post.id}`)} />
              ))}
            </div>
          )
        )}

        {aba === "colecoes" && (
          <CollectionsPanel ownerId={perfil.id} ownerName={nome} />
        )}

        {aba === "salvos" && (
          <div className="rounded-[12px] border border-dashed border-[var(--border)] p-10 text-center">
            <Lock className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">Salvos sao privados.</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Voce so ve os seus proprios posts salvos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
