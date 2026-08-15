import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync, readdirSync, existsSync, statSync, createReadStream } from 'fs'

// Dev-only: procura o arquivo livro.pdf local que corresponde ao titulo do livro
function findLocalPdf(contentDir, title) {
  try {
    const authorDirs = readdirSync(contentDir, { withFileTypes: true });
    for (const authorEntry of authorDirs) {
      if (!authorEntry.isDirectory()) continue;
      const authorPath = path.join(contentDir, authorEntry.name);
      let bookEntries;
      try { bookEntries = readdirSync(authorPath, { withFileTypes: true }); } catch { continue; }
      for (const bookEntry of bookEntries) {
        if (!bookEntry.isDirectory()) continue;
        const bookPath = path.join(authorPath, bookEntry.name);
        const indexPath = path.join(bookPath, 'index.js');
        const pdfPath = path.join(bookPath, 'livro.pdf');
        if (!existsSync(indexPath) || !existsSync(pdfPath)) continue;
        try {
          const content = readFileSync(indexPath, 'utf-8');
          const match = content.match(/"title"\s*:\s*"([^"]+)"/);
          if (match && match[1] === title) return pdfPath;
        } catch { continue; }
      }
    }
  } catch { /* ignore */ }
  return null;
}

// Cache em memória para modo dev: bookId -> caminho local do PDF
const devPdfCache = new Map();

// Plugin Vite que emula os endpoints serverless /api/book-pdf/ e /dev-pdf/ em dev local
function devBookPdfPlugin(env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  return {
    name: 'dev-book-pdf',
    configureServer(server) {
      // Rota 1: GET /api/book-pdf/{bookId} → JSON { data: { url } }
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/book-pdf\/([^?/]+)/);
        if (!match) return next();

        const bookId = decodeURIComponent(match[1]);

        const sendJson = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        if (!supabaseUrl || !supabaseKey) {
          return sendJson(503, { error: 'Supabase nao configurado no .env' });
        }

        try {
          // Busca metadados do livro no Supabase (incluindo pdf_path)
          const bookRes = await fetch(
            `${supabaseUrl}/rest/v1/books?id=eq.${encodeURIComponent(bookId)}&select=id,title,pdf_path,pdf_url&limit=1`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
          );
          const booksData = await bookRes.json();
          const book = Array.isArray(booksData) ? booksData[0] : null;
          if (!book) return sendJson(404, { error: 'Livro nao encontrado' });

          // Tentativa 1: URL assinada do Supabase Storage (pdf_path está preenchido no banco)
          const rawPath = String(book.pdf_path || book.pdf_url || '').trim();
          if (rawPath) {
            const marker = '/storage/v1/object/public/pdfs/';
            const markerIdx = rawPath.indexOf(marker);
            const objectPath = markerIdx >= 0
              ? decodeURIComponent(rawPath.slice(markerIdx + marker.length))
              : rawPath;

            const signRes = await fetch(
              `${supabaseUrl}/storage/v1/object/sign/pdfs/${objectPath}`,
              {
                method: 'POST',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expiresIn: 3600 }),
              }
            );
            const signData = await signRes.json();
            const signedPath = signData?.signedUrl || signData?.signedURL;
            if (signedPath) {
              const url = signedPath.startsWith('http')
                ? signedPath
                : `${supabaseUrl}/storage/v1${signedPath}`;
              return sendJson(200, { data: { url, expiresAt: new Date(Date.now() + 3600000).toISOString() } });
            }
          }

          // Tentativa 2: PDF local na pasta /content (fallback para desenvolvimento)
          const contentDir = path.resolve(__dirname, 'content');
          const localPdfPath = findLocalPdf(contentDir, book.title);
          if (localPdfPath) {
            devPdfCache.set(bookId, localPdfPath);
            console.log(`[dev-book-pdf] Servindo PDF local para "${book.title}": ${localPdfPath}`);
            return sendJson(200, {
              data: {
                url: `/dev-pdf/${encodeURIComponent(bookId)}`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            });
          }

          return sendJson(404, { error: 'Este livro ainda nao possui um PDF' });
        } catch (err) {
          return sendJson(500, { error: err?.message || 'Erro interno no servidor de desenvolvimento' });
        }
      });

      // Rota 2: GET /dev-pdf/{bookId} → transmite os bytes do PDF local
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/dev-pdf\/([^?/]+)/);
        if (!match) return next();

        const bookId = decodeURIComponent(match[1]);
        const filePath = devPdfCache.get(bookId);
        if (!filePath || !existsSync(filePath)) {
          res.statusCode = 404;
          res.end('PDF nao encontrado no cache de desenvolvimento');
          return;
        }

        try {
          const stat = statSync(filePath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Cache-Control', 'private, no-store');
          createReadStream(filePath).pipe(res);
        } catch {
          res.statusCode = 500;
          res.end('Erro ao ler arquivo PDF');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv com prefixo '' carrega TODAS as variaveis do .env (incluindo as sem VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), devBookPdfPlugin(env)],
    // Only the public URL and publishable key are read by client code.
    // Unprefixed SUPABASE_* variables stay server-only and are never bundled.
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
  };
})
