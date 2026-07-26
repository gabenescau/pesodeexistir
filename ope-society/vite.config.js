import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Só expõe prefixos seguros para o bundle do cliente. Não inclui 'SUPABASE_'
  // porque isso vazararia SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_PASSWORD caso
  // existissem no ambiente de build. O cliente lê apenas VITE_SUPABASE_*.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
})
