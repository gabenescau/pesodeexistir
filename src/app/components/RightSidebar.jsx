import { Link } from "react-router-dom";
import { useData } from "@/app/data/DataContext";
import { useRewards } from "@/app/data/RewardsContext";
import { levelFromXp } from "@/lib/rewards";
import { MissionsWidget } from "./MissionsWidget";
import { ReferralWidget } from "./ReferralWidget";

function AuthorAvatar({ author }) {
  const src = author.image;
  const isImage = src?.startsWith?.("http") || src?.startsWith?.("/") || src?.startsWith?.("data:");
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
      {isImage ? (
        <img src={src} alt={author.name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        author.initial
      )}
    </div>
  );
}

export function RightSidebar() {
  const { books = [], authors = [], posts = [] } = useData() || {};
  const { wallet } = useRewards() || {};
  const level = wallet?.level ?? (wallet ? levelFromXp(wallet.xp) : 1);
  const progressPct = wallet
    ? Math.max(0, Math.min(100, Math.round((wallet.levelProgress ?? 0) * 100)))
    : 0;
  const xpIntoLevel = wallet ? Math.max(0, wallet.xp - (wallet.levelXp || 0)) : 0;
  const xpForLevel = wallet ? Math.max(1, (wallet.nextLevelXp || 0) - (wallet.levelXp || 0)) : 100;

  const hashtagRegex = /#(\w+)/g;
  const tagCount = {};
  for (const post of (posts || [])) {
    const text = post?.text || "";
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      const tag = `#${match[1]}`;
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const popularTags = Object.entries(tagCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  const authorLikes = {};
  for (const book of (books || [])) {
    const authorId = book?.author_id || book?.authorId;
    if (authorId) {
      authorLikes[authorId] = (authorLikes[authorId] || 0) + (book?.likes || 0);
    }
  }
  const featuredAuthors = (authors || [])
    .map((author) => ({
      ...author,
      works: (books || []).filter((book) => (book?.author_id || book?.authorId) === author.id).length,
      totalLikes: authorLikes[author.id] || 0,
      initial: author.name?.charAt(0)?.toUpperCase() || "A",
    }))
    .filter((a) => a.totalLikes > 0)
    .sort((a, b) => b.totalLikes - a.totalLikes)
    .slice(0, 5);

  return (
    <aside className="hidden w-[260px] shrink-0 space-y-5 2xl:block">
      {wallet && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Meu progresso
            </h3>
            <span className="rounded-full bg-[var(--accent-mint)]/10 px-2 py-0.5 text-xs font-bold text-[var(--accent-mint)]">
              Nível {level}
            </span>
          </div>
          <div className="mb-1 flex items-end justify-between">
            <span className="text-lg font-semibold text-[var(--text-primary)]">{wallet.xp} XP</span>
            <span className="text-xs text-[var(--text-muted)]">{xpIntoLevel}/{xpForLevel}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--hover-overlay)]">
            <div className="h-full rounded-full bg-[var(--accent-mint)] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[var(--hover-overlay)] px-3 py-2">
            <span className="text-xs text-[var(--text-muted)]">Créditos OPE</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{wallet.credits}</span>
          </div>
        </div>
      )}

      {wallet && <MissionsWidget />}

      {wallet && <ReferralWidget />}

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Comunidade
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
          Biblioteca e comunidade conectadas aos dados cadastrados no projeto.
        </p>
        <div className="space-y-3 text-sm">
          {[
            { label: "Autores", value: authors.length },
            { label: "Livros", value: books.length },
            { label: "Discussões", value: posts.length, highlight: true },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{s.label}</span>
              <span className={`font-medium ${s.highlight ? "text-[var(--accent-mint)]" : "text-[var(--text-primary)]"}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Tags em alta
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(popularTags.length ? popularTags : ["Sem tags ainda"]).map((tag) => (
            <span
              key={tag}
              className="cursor-pointer rounded-[6px] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Autores em destaque
        </h3>
        <div className="space-y-3">
          {featuredAuthors.length ? featuredAuthors.map((author) => (
            <Link
              key={author.id || author.name}
              to={`/app/autor/${author.id}`}
              className="group flex items-center gap-3"
            >
              <AuthorAvatar author={author} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-secondary)]">
                  {author.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{author.works} {author.works === 1 ? "obra" : "obras"}</p>
              </div>
            </Link>
          )) : (
            <p className="text-xs text-[var(--text-muted)]">Nenhum autor cadastrado.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
