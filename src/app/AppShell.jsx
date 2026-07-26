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
import { AdminGuard } from "./components/AdminGuard";

export function AppShell() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="inicio" replace />} />
        {/* Início == Comunidade: a comunidade e o feed do app. Pago p/ assinantes. */}
        <Route path="inicio" element={<SubscriptionGuard><CommunityPage /></SubscriptionGuard>} />
        {/* Rota legada /comunidade redireciona para /inicio (mesma pagina). */}
        <Route path="comunidade" element={<Navigate to="/app/inicio" replace />} />
        <Route path="biblioteca" element={<SubscriptionGuard><LibraryPage /></SubscriptionGuard>} />
        <Route path="livro/:id" element={<SubscriptionGuard><BookDetailPage /></SubscriptionGuard>} />
        <Route path="ler/:id" element={<SubscriptionGuard><BookReaderPage /></SubscriptionGuard>} />
        <Route path="autor/:id" element={<SubscriptionGuard><AuthorPage /></SubscriptionGuard>} />
        <Route path="explorar" element={<SubscriptionGuard><ExplorePage /></SubscriptionGuard>} />
        <Route path="lancamentos" element={<SubscriptionGuard><ReleasesPage /></SubscriptionGuard>} />
        <Route path="perfil" element={<SubscriptionGuard><ProfilePage /></SubscriptionGuard>} />
        <Route path="perfil/:id" element={<SubscriptionGuard><PublicProfilePage /></SubscriptionGuard>} />
        <Route path="configuracoes" element={<SettingsPage />} />
        {/* Admin nao exige assinatura, so role=admin. Nao-admin -> inicio. */}
        <Route path="admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
        <Route path="*" element={<Navigate to="inicio" replace />} />
      </Routes>
      <MobileBottomNav />
    </Shell>
  );
}
