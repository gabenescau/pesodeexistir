import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, MessageCircle } from "@/lib/icons";
import { useData } from "@/app/data/DataContext";
import { PostCard } from "@/app/components/PostCard";

export function PostDetailPage() {
  const { id } = useParams();
  const { posts, deletePost, loading } = useData();
  const post = posts.find((item) => String(item.id) === String(id));

  if (!loading && !post) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 py-20 text-center">
        <MessageCircle className="size-10 text-[var(--text-muted)]" />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Post nao encontrado</h1>
        <p className="max-w-sm text-sm text-[var(--text-muted)]">Ele pode ter sido removido ou nao estar disponivel para sua conta.</p>
        <Link to="/app/inicio" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          Voltar ao feed
        </Link>
      </div>
    );
  }

  if (loading && !post) return null;
  if (!post) return <Navigate to="/app/inicio" replace />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24 lg:pb-8">
      <Link to="/app/inicio" className="inline-flex min-h-10 items-center gap-1 rounded-full text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <ChevronLeft className="size-4" />
        Feed
      </Link>
      <PostCard post={post} onDelete={deletePost} expanded />
    </div>
  );
}
