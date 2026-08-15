import { useEffect, useMemo, useState } from "react";
import { isSupabaseReady, supabase } from "../data/supabase";
import { CreatePost } from "../components/CreatePost";
import { PostCard } from "../components/PostCard";
import { RightSidebar } from "../components/RightSidebar";
import { useData } from "../data/DataContext";
import { AutocompleteSearch, buildSearchItems } from "@/components/ui/autocomplete";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function CommunityPage() {
  const {
    posts = [],
    deletePost,
    loading = false,
    books = [],
    authors = [],
    categories = [],
    loadMorePosts,
    postsHasMore = false,
    postsLoadingMore = false,
  } = useData() || {};
  const [filter] = useState("Todos");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca, 350);
  const [reacoes, setReacoes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);

  const searchItems = useMemo(
    () => buildSearchItems({ books: books || [], authors: authors || [], categories: categories || [] }),
    [books, authors, categories]
  );
  const visiblePostIds = useMemo(
    () => (posts || []).slice(0, 200).map((post) => post?.id).filter(Boolean),
    [posts]
  );
  const visiblePostIdsKey = visiblePostIds.join(",");

  useEffect(() => {
    let ativo = true;
    if (!isSupabaseReady() || visiblePostIds.length === 0) {
      setReacoes([]);
      return undefined;
    }

    supabase
      .from("reactions")
      .select("target_id, user_id, emoji")
      .eq("target_type", "post")
      .in("target_id", visiblePostIds)
      .limit(5000)
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setReacoes(data || []);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [visiblePostIdsKey]);

  useEffect(() => {
    setVisibleCount(20);
  }, [filter, buscaDebounced]);

  const reacoesPorPost = useMemo(() => {
    const mapa = {};
    for (const reacao of (reacoes || [])) {
      if (reacao?.target_id) {
        (mapa[reacao.target_id] ||= []).push(reacao);
      }
    }
    return mapa;
  }, [reacoes]);

  const filteredPosts = useMemo(() => {
    const safePosts = Array.isArray(posts) ? posts : [];
    const semThreads = safePosts.filter(
      (p) => p && !(p.tag || "").startsWith("entity-thread:")
    );
    let result = semThreads;
    if (filter !== "Todos") {
      if (filter === "Em alta") {
        result = [...semThreads].sort((a, b) => (b?.likes || 0) - (a?.likes || 0));
      } else {
        result = semThreads.filter(p => p?.tag === filter);
      }
    }

    const termo = buscaDebounced.trim().toLowerCase();
    if (termo) {
      result = result.filter((post) =>
        post && [post.text, post.author, post.handle, post.tag, post.book?.title]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(termo))
      );
    }

    return result;
  }, [posts, filter, buscaDebounced]);
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  async function handleLoadMore() {
    if (postsHasMore && !postsLoadingMore) {
      await loadMorePosts?.();
    }
    setVisibleCount((count) => count + 20);
  }

  return (
    <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-10">
      {/* ── Feed principal ── */}
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5 sm:space-y-6 2xl:mx-0">
        <AutocompleteSearch
          placeholder="Pesquisar posts, pessoas ou livros..."
          items={searchItems}
          onQueryChange={setBusca}
          inputClassName="h-11 rounded-[10px] sm:h-12"
        />

        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Comunidade</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Seu feed de leituras, ideias e conversas.</p>
          </div>
          <CreatePost />
        </div>



        <div className="space-y-4 sm:space-y-5">
          {loading && (
            <>
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
                  <div className="flex gap-3">
                    <div className="size-11 rounded-full bg-[var(--hover-overlay)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-44 rounded bg-[var(--hover-overlay)]" />
                      <div className="h-3 w-28 rounded bg-[var(--hover-overlay)]" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="h-4 rounded bg-[var(--hover-overlay)]" />
                    <div className="h-4 w-5/6 rounded bg-[var(--hover-overlay)]" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={deletePost}
              reacoesIniciais={reacoesPorPost[post.id] || []}
            />
          ))}

          {!loading && (filteredPosts.length > visiblePosts.length || postsHasMore) && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={postsLoadingMore}
              className="min-h-11 w-full rounded-full border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              {postsLoadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          )}

          {!loading && filteredPosts.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
              Nada encontrado por aqui.
            </p>
          )}
        </div>
      </div>

      {/* ── Sidebar direita (apenas 2xl+) ── */}
      <RightSidebar />
    </div>
  );
}
