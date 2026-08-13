import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell as Shell } from "@/components/app-shell";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SubscriptionGuard } from "./components/SubscriptionGuard";
import { AdminGuard } from "./components/AdminGuard";

const lazyPage = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const CommunityPage = lazyPage(() => import("./pages/CommunityPage"), "CommunityPage");
const LibraryPage = lazyPage(() => import("./pages/LibraryPage"), "LibraryPage");
const AuthorsPage = lazyPage(() => import("./pages/AuthorsPage"), "AuthorsPage");
const BookDetailPage = lazyPage(() => import("./pages/BookDetailPage"), "BookDetailPage");
const BookReaderPage = lazyPage(() => import("./pages/BookReaderPage"), "BookReaderPage");
const AuthorPage = lazyPage(() => import("./pages/AuthorPage"), "AuthorPage");
const ExplorePage = lazyPage(() => import("./pages/ExplorePage"), "ExplorePage");
const ReleasesPage = lazyPage(() => import("./pages/ReleasesPage"), "ReleasesPage");
const PublicProfilePage = lazyPage(() => import("./pages/PublicProfilePage"), "PublicProfilePage");
const SettingsPage = lazyPage(() => import("./pages/SettingsPage"), "SettingsPage");
const SuggestionsPage = lazyPage(() => import("./pages/SuggestionsPage"), "SuggestionsPage");
const PostDetailPage = lazyPage(() => import("./pages/PostDetailPage"), "PostDetailPage");
const AdminPage = lazyPage(() => import("./pages/AdminPage"), "AdminPage");
const SubscribePage = lazyPage(() => import("./pages/SubscribePage"), "SubscribePage");
const NotificacoesPage = lazyPage(() => import("./pages/NotificacoesPage"), "NotificacoesPage");
const StorePage = lazyPage(() => import("./pages/StorePage"), "StorePage");
const ProductDetailPage = lazyPage(() => import("./pages/ProductDetailPage"), "ProductDetailPage");
const DailyMissionsPage = lazyPage(() => import("./pages/DailyMissionsPage"), "DailyMissionsPage");
const ReferralPage = lazyPage(() => import("./pages/ReferralPage"), "ReferralPage");
const SeasonPage = lazyPage(() => import("./pages/SeasonPage"), "SeasonPage");
const MyRedemptionsPage = lazyPage(() => import("./pages/MyRedemptionsPage"), "MyRedemptionsPage");
const SupportPage = lazyPage(() => import("./pages/SupportPage"), "SupportPage");
const MyListPage = lazyPage(() => import("./pages/MyListPage"), "MyListPage");
const RankingPage = lazyPage(() => import("./pages/RankingPage"), "RankingPage");
const InstallAppPage = lazyPage(() => import("./pages/InstallAppPage"), "InstallAppPage");

function PageLoading() {
  return (
    <div className="fixed inset-x-0 top-14 z-[55] h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-full bg-[var(--accent-mint)]" />
    </div>
  );
}

export function AppShell() {
  return (
    <Shell>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="inicio" replace />} />
        {/* Comunidade, catalogo e loja sao acessiveis a qualquer usuario autenticado. */}
        <Route path="inicio" element={<CommunityPage />} />
        {/* Rota legada /comunidade redireciona para /inicio (mesma pagina). */}
        <Route path="comunidade" element={<Navigate to="/app/inicio" replace />} />
        <Route path="biblioteca" element={<LibraryPage />} />
        <Route path="autores" element={<AuthorsPage />} />
        <Route path="livro/:id" element={<BookDetailPage />} />
        <Route path="ler/:id" element={<SubscriptionGuard><BookReaderPage /></SubscriptionGuard>} />
        <Route path="autor/:id" element={<AuthorPage />} />
        <Route path="explorar" element={<ExplorePage />} />
        <Route path="lancamentos" element={<ReleasesPage />} />
        <Route path="sugestoes" element={<SuggestionsPage />} />
        <Route path="notificacoes" element={<NotificacoesPage />} />
        <Route path="loja" element={<StorePage />} />
        <Route path="loja/produto/:id" element={<ProductDetailPage />} />
        <Route path="missoes" element={<SubscriptionGuard feature="missions"><DailyMissionsPage /></SubscriptionGuard>} />
        <Route path="indicacoes" element={<ReferralPage />} />
        <Route path="seasons" element={<SubscriptionGuard feature="seasons"><SeasonPage /></SubscriptionGuard>} />
        <Route path="ranking" element={<SubscriptionGuard feature="ranking"><RankingPage /></SubscriptionGuard>} />
        <Route path="instalar" element={<InstallAppPage />} />
        <Route path="meus-resgates" element={<MyRedemptionsPage />} />
        <Route path="suporte" element={<SupportPage />} />
        <Route path="minha-lista" element={<MyListPage />} />
        <Route path="post/:id" element={<PostDetailPage />} />
        <Route path="planos" element={<SubscribePage />} />
        <Route path="perfil" element={<Navigate to="/app/configuracoes?aba=perfil" replace />} />
        <Route path="perfil/:id" element={<PublicProfilePage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        {/* Admin nao exige assinatura, so role=admin. Nao-admin -> inicio. */}
        <Route path="admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
          <Route path="*" element={<Navigate to="inicio" replace />} />
        </Routes>
      </Suspense>
      <MobileBottomNav />
    </Shell>
  );
}
