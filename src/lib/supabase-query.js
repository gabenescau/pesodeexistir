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

const DEFAULT_PAGE_SIZE = 250;
const MAX_PAGE_SIZE = 500;
const DEFAULT_MAX_ROWS = 2000;
const DEFAULT_MAX_PAGES = 20;

// Cache curto em memoria para leituras publicas e idempotentes. O mapa de
// promessas tambem evita que duas montagens simultaneas disparem a mesma
// consulta. Nunca use para perfil, permissao, assinatura ou carteira.
const queryCache = new Map();

function cacheEntryIsFresh(entry, now = Date.now()) {
  return entry && entry.value !== undefined && entry.expiresAt > now;
}

export function invalidateSupabaseQueryCache(prefix = "") {
  for (const key of queryCache.keys()) {
    if (!prefix || key.startsWith(prefix)) queryCache.delete(key);
  }
}

export async function runSupabaseCachedQuery(
  queryFactory,
  label,
  cacheKey,
  { ttlMs = 30_000, retries = 2 } = {}
) {
  const key = String(cacheKey || label);
  const cached = queryCache.get(key);
  if (cacheEntryIsFresh(cached)) return cached.value;
  if (cached?.promise) return cached.promise;

  const promise = runSupabaseQuery(queryFactory, label, retries)
    .then((result) => {
      if (!result?.error) {
        queryCache.set(key, {
          value: result,
          expiresAt: Date.now() + Math.max(1_000, Number(ttlMs) || 30_000),
        });
      } else {
        queryCache.delete(key);
      }
      return result;
    })
    .finally(() => {
      const current = queryCache.get(key);
      if (current?.promise === promise) {
        if (current.value !== undefined) queryCache.set(key, current);
        else queryCache.delete(key);
      }
    });

  queryCache.set(key, { promise });
  return promise;
}

export function runSupabaseCachedQueryAll(
  queryFactory,
  label,
  cacheKey,
  { ttlMs = 30_000, retries = 2, ...pagination } = {}
) {
  return runSupabaseCachedQuery(
    () => runSupabaseQueryAll(queryFactory, label, { retries, ...pagination }),
    label,
    cacheKey,
    { ttlMs, retries: 0 }
  );
}

// Busca todas as linhas de uma consulta, paginando com .range() em loops.
// Necessario porque o PostgREST/SignalR limita cada chamada a 1000 linhas por
// padrao — sem isso listas grandes (livros, autores, posts) aparecem truncadas
// na UI mesmo com paginacao client-side.
export async function runSupabaseQueryAll(queryFactory, label, {
  pageSize = DEFAULT_PAGE_SIZE,
  retries = 2,
  maxRows = DEFAULT_MAX_ROWS,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  const results = [];
  const seen = new Set();
  let offset = 0;
  const safePageSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safeMaxRows = Math.max(Number(maxRows) || DEFAULT_MAX_ROWS, safePageSize);
  const safeMaxPages = Math.max(Number(maxPages) || DEFAULT_MAX_PAGES, 1);

  for (let page = 0; page < safeMaxPages && results.length < safeMaxRows; page += 1) {
    const pageLimit = Math.min(safePageSize, safeMaxRows - results.length);
    const pageFactory = () => queryFactory().range(offset, offset + pageLimit - 1);
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

    if (rows.length < pageLimit) break;
    offset += pageLimit;
  }

  return {
    data: results,
    error: null,
    count: results.length,
    truncated: results.length >= safeMaxRows,
  };
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
