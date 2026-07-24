import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, MessageCircle, Users } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { FollowButton } from "../components/FollowButton";
import { PostCard } from "../components/PostCard";
import { AchievementsPanel } from "../components/AchievementsPanel";
import { UserTitlePill } from "../components/UserTitlePill";
import { handleDoPerfil } from "@/lib/mentions";

function Avatar({ src, fallback }) {
  const [quebrada, setQuebrada] = useState(false);
  const ehImagem = !quebrada && (src?.startsWith?.("http") || src?.startsWith?.("data:"));

  return (
    <div className="size-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--hover-overlay)] text-2xl font-bold text-[var(--text-primary)] sm:size-24">
      {ehImagem ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setQuebrada(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      )}
    </div>
  );
}

export function PublicProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    profiles, posts, deletePost, followerCounts, followingCounts, follows, getUserMetrics,
  } = useData();
  const [aba, setAba] = useState("posts");

  // O proprio perfil tem edicao: manda para a tela completa.
  if (id === user?.id) return <Navigate to="/app/perfil" replace />;

  const perfil = profiles.find((item) => item.id === id);

  if (!perfil) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          Perfil não encontrado ou marcado como privado.
        </p>
        <Link to="/app/comunidade" className="mt-4 inline-block text-sm text-[var(--text-primary)] hover:underline">
          Voltar para a comunidade
        </Link>
      </div>
    );
  }

  const nome = perfil.name || "Leitor";
  const postsDoPerfil = posts.filter((post) => post.user_id === perfil.id);
  const seguidores = follows.filter((item) => item.following_id === perfil.id);
  const seguindo = follows.filter((item) => item.follower_id === perfil.id);

  const listas = {
    posts: postsDoPerfil,
    seguidores: seguidores.map((item) => profiles.find((p) => p.id === item.follower_id)).filter(Boolean),
    seguindo: seguindo.map((item) => profiles.find((p) => p.id === item.following_id)).filter(Boolean),
  };

  const abas = [
    { id: "posts", rotulo: "Publicações", total: postsDoPerfil.length },
    { id: "seguidores", rotulo: "Seguidores", total: followerCounts[perfil.id] || 0 },
    { id: "seguindo", rotulo: "Seguindo", total: followingCounts[perfil.id] || 0 },
  ];

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      <Link to="/app/comunidade" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ChevronLeft className="size-4" /> Comunidade
      </Link>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar src={perfil.avatar} fallback={nome.charAt(0).toUpperCase()} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">{nome}</h1>
              <UserTitlePill userId={perfil.id} />
            </div>
            <p className="text-sm text-[var(--text-muted)]">@{handleDoPerfil(perfil)}</p>
            {perfil.bio && (
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)] sm:mx-0">{perfil.bio}</p>
            )}

            <div className="mt-4 flex justify-center sm:justify-start">
              <FollowButton userId={perfil.id} />
            </div>
          </div>
        </div>
      </div>

      <AchievementsPanel metrics={getUserMetrics(perfil.id)} compact />

      <div className="flex gap-2 overflow-x-auto">
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
              aba === item.id
                ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
            }`}
          >
            {item.rotulo} · {item.total}
          </button>
        ))}
      </div>

      {aba === "posts" && (
        <div className="space-y-4">
          {listas.posts.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
              <MessageCircle className="mx-auto mb-2 size-5" />
              Nenhuma publicação por aqui ainda.
            </p>
          ) : (
            listas.posts.map((post) => <PostCard key={post.id} post={post} onDelete={deletePost} />)
          )}
        </div>
      )}

      {aba !== "posts" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {listas[aba].length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)] sm:col-span-2">
              <Users className="mx-auto mb-2 size-5" />
              Lista vazia por enquanto.
            </p>
          ) : (
            listas[aba].map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <Link to={`/app/perfil/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="size-10 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)]">
                    {item.avatar?.startsWith?.("http") ? (
                      <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--text-primary)]">
                        {(item.name || "L").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.name || "Leitor"}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">@{handleDoPerfil(item)}</p>
                  </div>
                </Link>
                <FollowButton userId={item.id} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
