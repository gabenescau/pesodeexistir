import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, ChatCircle, Heart, UserPlus } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { handleDoPerfil } from "@/lib/mentions";
import { relativeTime as tempoRelativoPost } from "@/lib/social";

function NotificacaoItem({ icon: Icon, accent, quem, acao, alvo, link, criadoEm, avatar }) {
  return (
    <Link
      to={link}
      className="flex items-start gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-colors hover:bg-[var(--hover-overlay)]"
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--bg-card)]"
          style={{ background: accent }}
        >
          <Icon className="size-4" weight="fill" />
        </span>
      )}
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p>
          <span className="font-medium text-[var(--text-primary)]">{quem}</span> {acao}{" "}
          <span className="font-medium text-[var(--text-primary)]">{alvo}</span>
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">{tempoRelativoPost(criadoEm)}</p>
      </div>
    </Link>
  );
}

export function NotificacoesPage() {
  const { user } = useAuth();
  const { posts, profiles, reactions, follows } = useData();

  const notificacoes = useMemo(() => {
    if (!user?.id) return [];
    const items = [];
    const authorById = new Map(profiles.map((p) => [p.id, p]));

    // Reacoes em posts do usuario
    for (const reacao of reactions) {
      if (reacao.target_type !== "post") continue;
      const post = posts.find((p) => p.id === reacao.target_id);
      if (!post || post.user_id !== user.id || reacao.user_id === user.id) continue;
      const autor = authorById.get(reacao.user_id);
      if (!autor) continue;
      items.push({
        id: `reacao-${reacao.id}`,
        icon: Heart,
        accent: "#c78359",
        quem: autor.name || "Leitor",
        acao: "curtiu seu post",
        alvo: (post.text || "").slice(0, 60) || "post",
        link: `/app/post/${post.id}`,
        criadoEm: reacao.created_at,
        avatar: autor.avatar,
      });
    }

    // Novos seguidores
    for (const follow of follows) {
      if (follow.following_id !== user.id) continue;
      const autor = authorById.get(follow.follower_id);
      if (!autor) continue;
      items.push({
        id: `follow-${follow.follower_id}-${follow.following_id}`,
        icon: UserPlus,
        accent: "#3b82f6",
        quem: autor.name || "Leitor",
        acao: "comecou a seguir voce",
        alvo: "",
        link: `/app/perfil/${follow.follower_id}`,
        criadoEm: follow.created_at,
        avatar: autor.avatar,
      });
    }

    return items
      .sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime())
      .slice(0, 50);
  }, [user?.id, posts, profiles, reactions, follows]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notificacoes</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Atividade recente em seus posts, comentarios e seguidores.
        </p>
      </div>

      {notificacoes.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
          <Bell className="mx-auto mb-3 size-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">Nenhuma notificacao por aqui ainda.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Quando alguem curtir seu post ou comecar a seguir voce, aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notificacoes.map((item) => (
            <li key={item.id}>
              <NotificacaoItem {...item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
