const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "connection",
  "err_http2",
  "err_connection",
  "load failed",
];

function isNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_PAGE_SIZE = 1000;

// Busca todas as linhas de uma consulta, paginando com .range() em loops.
// Necessario porque o PostgREST/SignalR limita cada chamada a 1000 linhas por
// padrao — sem isso listas grandes (livros, autores, posts) aparecem truncadas
// na UI mesmo com paginacao client-side.
export async function runSupabaseQueryAll(queryFactory, label, { pageSize = DEFAULT_PAGE_SIZE, retries = 2 } = {}) {
  const results = [];
  const seen = new Set();
  let offset = 0;

  for (;;) {
    const pageFactory = () => queryFactory().range(offset, offset + pageSize - 1);
    const result = await runSupabaseQuery(pageFactory, `${label} (paginacao ${offset}+)`, retries);
    const rows = result?.data || [];
    if (result?.error) return result;
    if (rows.length === 0) break;

    for (const row of rows) {
      const key = row.id ?? `${offset}:${results.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(row);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { data: results, error: null, count: results.length };
}

export async function runSupabaseQuery(queryFactory, label, retries = 2) {
  let lastResult = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await queryFactory();
      lastResult = result;

      if (!result?.error || !isNetworkError(result.error) || attempt === retries) {
        if (result?.error) {
          console.warn(`[Supabase] ${label}:`, result.error.message || result.error);
        }
        return result;
      }
    } catch (error) {
      lastResult = { data: null, error };

      if (!isNetworkError(error) || attempt === retries) {
        console.warn(`[Supabase] ${label}:`, error.message || error);
        return lastResult;
      }
    }

    await wait(350 * (attempt + 1));
  }

  return lastResult || { data: null, error: new Error(`Falha ao executar ${label}`) };
}
