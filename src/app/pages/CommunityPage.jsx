import { useEffect, useMemo, useState } from "react";
import { isSupabaseReady, supabase } from "../data/supabase";
import { CreatePost } from "../components/CreatePost";
import { PostCard } from "../components/PostCard";
import { useData } from "../data/DataContext";
import { AutocompleteSearch, buildSearchItems } from "@/components/ui/autocomplete";

export function CommunityPage() {
  const { posts = [], deletePost, loading = false, books = [], authors = [], categories = [] } = useData() || {};
  const [filter] = useState("Todos");
  const [busca] = useState("");
  const [reacoes, setReacoes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);

  const searchItems = useMemo(
    () => buildSearchItems({ books: books || [], authors: authors || [], categories: categories || [] }),
    [books, authors, categories]
  );

  useEffect(() => {
    let ativo = true;
    if (!isSupabaseReady()) return undefined;

    supabase
      .from("reactions")
      .select("target_id, user_id, emoji")
      .eq("target_type", "post")
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setReacoes(data || []);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [(posts || []).length]);

  useEffect(() => {
    setVisibleCount(20);
  }, [filter, busca]);

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

    const termo = busca.trim().toLowerCase();
    if (termo) {
      result = result.filter((post) =>
        post && [post.text, post.author, post.handle, post.tag, post.book?.title]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(termo))
      );
    }

    return result;
  }, [posts, filter, busca]);
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5 sm:space-y-6 2xl:mx-0">
        <AutocompleteSearch
          placeholder="Pesquisar posts, pessoas ou livros..."
          items={searchItems}
        />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Comunidade</h1>
            <p className="text-sm text-[var(--text-muted)]">Seu feed de leituras, ideias e conversas.</p>
          </div>
          <CreatePost />
        </div>

        {/* Filtros por categoria ocultos: ainda nao ha posts suficientes
            marcados com essas tags e a UI exibia "Nada encontrado por aqui"
            para todas as opcoes. Quando o volume voltar, reintroduzir o
            <FilterPills /> aqui com filtro opcional. */}

        <div className="space-y-4 sm:space-y-5">
          {loading && (
            <>
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
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

          {!loading && filteredPosts.length > visiblePosts.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 20)}
              className="min-h-11 w-full rounded-full border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              Carregar mais
            </button>
          )}

          {!loading && filteredPosts.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
              Nada encontrado por aqui.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
