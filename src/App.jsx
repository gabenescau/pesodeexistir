import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LandingPage } from '@/components/LandingPage'
import { AuthPage } from '@/components/auth-page'
import { AppShell } from '@/app/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DataProvider } from '@/app/data/DataContext'
import { SubscribePage } from '@/app/pages/SubscribePage'
import { ProcessingPage } from '@/app/pages/ProcessingPage'
import { useEffect } from 'react'

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
      '/app/comunidade': 'Comunidade | OPE Club',
      '/app/perfil': 'Perfil | OPE Club',
      '/app/configuracoes': 'Configurações | OPE Club',
      '/app/admin': 'Painel Admin | OPE Club',
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route path="/assinar" element={<ProtectedRoute><SubscribePage /></ProtectedRoute>} />
        <Route path="/pagamento/processando" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
        <Route path="/app/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataProvider>
  )
}
