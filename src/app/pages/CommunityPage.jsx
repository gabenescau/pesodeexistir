import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { isSupabaseReady, supabase } from "../data/supabase";
import { CreatePost } from "../components/CreatePost";
import { FilterPills } from "../components/FilterPills";
import { PostCard } from "../components/PostCard";
import { RightSidebar } from "../components/RightSidebar";
import { useData } from "../data/DataContext";

export function CommunityPage() {
  const { posts, deletePost, loading } = useData();
  const [filter, setFilter] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [reacoes, setReacoes] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);

  // Uma consulta para as reacoes do feed inteiro, em vez de uma por card.
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
      });

    return () => {
      ativo = false;
    };
  }, [posts.length]);

  useEffect(() => {
    setVisibleCount(20);
  }, [filter, busca]);

  const reacoesPorPost = useMemo(() => {
    const mapa = {};
    for (const reacao of reacoes) {
      (mapa[reacao.target_id] ||= []).push(reacao);
    }
    return mapa;
  }, [reacoes]);

  const filteredPosts = (() => {
    let result = posts;
    if (filter !== "Todos") {
      if (filter === "Em alta") {
        result = [...posts].sort((a, b) => b.likes - a.likes);
      } else {
        result = posts.filter(p => p.tag === filter);
      }
    }

    // O campo de busca existia na tela mas nao filtrava nada.
    const termo = busca.trim().toLowerCase();
    if (termo) {
      result = result.filter((post) =>
        [post.text, post.author, post.handle, post.tag, post.book?.title]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(termo))
      );
    }

    return result;
  })();
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5 sm:space-y-6 2xl:mx-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[var(--text-placeholder)]" />
          <input
            type="text"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Pesquisar posts, pessoas ou livros..."
            className="w-full h-10 sm:h-12 pl-11 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Comunidade</h1>
            <p className="text-sm text-[var(--text-muted)]">Seu feed de leituras, ideias e conversas.</p>
          </div>
          <CreatePost />
        </div>

        <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
          <FilterPills active={filter} onChange={setFilter} />
        </div>

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

      <RightSidebar />
    </div>
  );
}
