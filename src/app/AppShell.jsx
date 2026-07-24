import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell as Shell } from "@/components/app-shell";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { CommunityPage } from "./pages/CommunityPage";
import { LibraryPage } from "./pages/LibraryPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { BookReaderPage } from "./pages/BookReaderPage";
import { AuthorPage } from "./pages/AuthorPage";
import { ExplorePage } from "./pages/ExplorePage";
import { ReleasesPage } from "./pages/ReleasesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";
import { SubscriptionGuard } from "./components/SubscriptionGuard";

export function AppShell() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<CommunityPage />} />
        <Route path="comunidade" element={<CommunityPage />} />
        <Route path="biblioteca" element={<SubscriptionGuard><LibraryPage /></SubscriptionGuard>} />
        <Route path="livro/:id" element={<SubscriptionGuard><BookDetailPage /></SubscriptionGuard>} />
        <Route path="ler/:id" element={<SubscriptionGuard><BookReaderPage /></SubscriptionGuard>} />
        <Route path="autor/:id" element={<AuthorPage />} />
        <Route path="explorar" element={<SubscriptionGuard><ExplorePage /></SubscriptionGuard>} />
        <Route path="lancamentos" element={<SubscriptionGuard><ReleasesPage /></SubscriptionGuard>} />
        <Route path="perfil" element={<SubscriptionGuard><ProfilePage /></SubscriptionGuard>} />
        <Route path="perfil/:id" element={<SubscriptionGuard><PublicProfilePage /></SubscriptionGuard>} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="inicio" replace />} />
      </Routes>
      <MobileBottomNav />
    </Shell>
  );
}
