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
