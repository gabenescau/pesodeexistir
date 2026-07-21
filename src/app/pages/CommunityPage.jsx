import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { TabNav } from "../components/TabNav";
import { CreatePost } from "../components/CreatePost";
import { FilterPills } from "../components/FilterPills";
import { PostCard } from "../components/PostCard";
import { RightSidebar } from "../components/RightSidebar";
import { useData } from "../data/DataContext";

const tabRoutes = {
  Comunidade: null,
  Biblioteca: "/app/biblioteca",
  Autores: "/app/explorar",
  "Meu perfil": "/app/perfil",
};

const tabFilters = {
  Clubes: "Clubes",
  Eventos: "Eventos",
  "Em alta": "Em alta",
};

export function CommunityPage() {
  const { posts } = useData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("Todos");
  const [tab, setTab] = useState("Comunidade");

  const filteredPosts = (() => {
    let result = posts;
    if (filter !== "Todos") {
      if (filter === "Em alta") {
        result = [...posts].sort((a, b) => b.likes - a.likes);
      } else {
        result = posts.filter(p => p.tag === filter);
      }
    }
    return result;
  })();

  function handleTabChange(tab) {
    const route = tabRoutes[tab];
    if (route) {
      navigate(route);
      return;
    }
    if (tabFilters[tab]) {
      setFilter(tabFilters[tab]);
    }
    setTab(tab);
  }

  return (
    <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-10">
      <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-5 sm:space-y-6 2xl:mx-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[var(--text-placeholder)]" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-full h-10 sm:h-12 pl-11 pr-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
          />
        </div>

        <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
          <TabNav active={tab} onChange={handleTabChange} />
        </div>

        <CreatePost />

        <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
          <FilterPills active={filter} onChange={setFilter} />
        </div>

        <div className="space-y-4 sm:space-y-5">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      <RightSidebar />
    </div>
  );
}
