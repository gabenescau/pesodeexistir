import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Toaster } from '@/components/toaster'
import { DataProvider } from '@/app/data/DataContext'

const LandingPage = lazy(() => import('@/components/LandingPage').then((module) => ({ default: module.LandingPage })))
const AuthPage = lazy(() => import('@/components/auth-page').then((module) => ({ default: module.AuthPage })))
const AppShell = lazy(() => import('@/app/AppShell').then((module) => ({ default: module.AppShell })))
const SubscribePage = lazy(() => import('@/app/pages/SubscribePage').then((module) => ({ default: module.SubscribePage })))
const ProcessingPage = lazy(() => import('@/app/pages/ProcessingPage').then((module) => ({ default: module.ProcessingPage })))

function RouteLoading() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] rounded-full bg-[var(--accent-mint)]" />
    </div>
  );
}

function SEOHead() {
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    const titles = {
      '/': 'OPE Club | Biblioteca e Comunidade de Filosofia e Literatura',
      '/entrar': 'Entrar | OPE Club',
      '/assinar': 'Assinar | OPE Club',
      '/pagamento/processando': 'Processando Pagamento | OPE Club',
      '/app/inicio': 'Início | OPE Club',
      '/app/biblioteca': 'Biblioteca | OPE Club',
      '/app/explorar': 'Explorar | OPE Club',
      '/app/perfil': 'Perfil | OPE Club',
      '/app/configuracoes': 'Configurações | OPE Club',
      '/app/sugestoes': 'Sugestões | OPE Club',
      '/app/post': 'Post | OPE Club',
      '/app/admin': 'Painel Admin | OPE Club',
      '/app/planos': 'Planos | OPE Club',
      '/app/lancamentos': 'Lançamentos Semanais | OPE Club',
    }
    const base = Object.keys(titles)
      .sort((a, b) => b.length - a.length)
      .find((key) => path.startsWith(key))

    document.title = titles[base] || 'OPE Club'
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <DataProvider>
      <SEOHead />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/entrar" element={<AuthPage />} />
          <Route path="/assinar" element={<ProtectedRoute><SubscribePage /></ProtectedRoute>} />
          <Route path="/pagamento/processando" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
          <Route path="/app/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </DataProvider>
  )
}
