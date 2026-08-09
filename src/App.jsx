import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Toaster } from '@/components/toaster'
import { DataProvider } from '@/app/data/DataContext'
import { RewardsProvider } from '@/app/data/RewardsContext'
import { Seo } from '@/components/seo'

const AuthPage = lazy(() => import('@/components/auth-page').then((module) => ({ default: module.AuthPage })))
const AppShell = lazy(() => import('@/app/AppShell').then((module) => ({ default: module.AppShell })))
const SubscribePage = lazy(() => import('@/app/pages/SubscribePage').then((module) => ({ default: module.SubscribePage })))

function RouteLoading() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-full bg-[var(--accent-mint)]" />
    </div>
  );
}

const DEFAULT_DESCRIPTION =
  'OPE Club e uma biblioteca digital e comunidade para quem ama filosofia e literatura. Leia grandes autores, discuta livros e participe de uma comunidade que pensa junto.';

const SEO_PAGES = {
  '/': {
    title: 'OPE Club | Biblioteca e Comunidade de Filosofia e Literatura',
    description: DEFAULT_DESCRIPTION,
    type: 'website',
  },
  '/entrar': {
    title: 'Entrar | OPE Club',
    description: 'Acesse sua biblioteca, suas notas e a comunidade de filosofia e literatura do OPE Club.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/assinar': {
    title: 'Assinar OPE Club | Acesso completo a biblioteca e comunidade',
    description: 'A partir de R$ 14/mes, leia a biblioteca completa de filosofia e literatura, publique na comunidade e participe dos lancamentos semanais.',
    type: 'product',
  },
  '/app/inicio': {
    title: 'Comunidade | OPE Club',
    description: 'Posts, discussoes e recomendacoes da comunidade OPE Club.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/biblioteca': {
    title: 'Biblioteca | OPE Club',
    description: 'Acervo curado de livros de filosofia, literatura e psicanalise. Filtre por autor, categoria ou escola de pensamento.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/explorar': {
    title: 'Explorar | OPE Club',
    description: 'Descubra novos autores, livros e ideias dentro do OPE Club.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/ranking': {
    title: 'Ranking Mensal | OPE Club',
    description: 'Acompanhe os leitores mais ativos e engajados da comunidade no Ranking Mensal.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/sugestoes': {
    title: 'Sugestoes da Comunidade | OPE Club',
    description: 'Sugestoes dos leitores para melhorar a biblioteca e a experiencia do clube.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/lancamentos': {
    title: 'Lancamentos Semanais | OPE Club',
    description: 'Livros novos toda semana para assinantes do OPE Club.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/planos': {
    title: 'Planos | OPE Club',
    description: 'Escolha entre o plano mensal ou anual e tenha acesso a biblioteca completa.',
    type: 'product',
  },
  '/app/perfil': {
    title: 'Perfil | OPE Club',
    description: 'Edite seu perfil publico no OPE Club.',
    type: 'profile',
    robots: 'noindex, nofollow',
  },
  '/app/configuracoes': {
    title: 'Configuracoes | OPE Club',
    description: 'Preferencias, privacidade e seguranca da sua conta.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
  '/app/admin': {
    title: 'Painel Admin | OPE Club',
    description: 'Gestao interna do clube.',
    type: 'website',
    robots: 'noindex, nofollow',
  },
};

function resolveSeo(path) {
  const keys = Object.keys(SEO_PAGES).sort((a, b) => b.length - a.length);
  const key = keys.find((k) => (k === '/' ? path === '/' : path.startsWith(k)));
  return { key: key || '/', meta: SEO_PAGES[key || '/'] };
}

function SEOHead() {
  const location = useLocation();
  const { key, meta } = resolveSeo(location.pathname);
  const canonical = `https://pesodeexistir.online${key === '/' ? '/' : location.pathname}`;
  return (
    <Seo
      title={meta.title}
      description={meta.description}
      canonical={canonical}
      type={meta.type}
      robots={meta.robots}
    />
  );
}

export default function App() {
  return (
    <DataProvider>
      <RewardsProvider>
        <SEOHead />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/entrar" replace />} />
            <Route path="/entrar" element={<AuthPage />} />
            <Route path="/assinar" element={<ProtectedRoute><SubscribePage /></ProtectedRoute>} />
            <Route path="/app/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster />
      </RewardsProvider>
    </DataProvider>
  );
}
