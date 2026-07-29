import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DataProvider } from '@/app/data/DataContext'

const LandingPage = lazy(() => import('@/components/LandingPage').then((module) => ({ default: module.LandingPage })))
const AuthPage = lazy(() => import('@/components/auth-page').then((module) => ({ default: module.AuthPage })))
const AppShell = lazy(() => import('@/app/AppShell').then((module) => ({ default: module.AppShell })))
const SubscribePage = lazy(() => import('@/app/pages/SubscribePage').then((module) => ({ default: module.SubscribePage })))
const ProcessingPage = lazy(() => import('@/app/pages/ProcessingPage').then((module) => ({ default: module.ProcessingPage })))

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] text-sm text-[var(--text-muted)]">
      Carregando...
    </div>
  )
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
    </DataProvider>
  )
}
