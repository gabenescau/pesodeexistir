const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL;

const supabasePublicKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublicKey) {
  console.warn(
    "Supabase public credentials not found. Check the Vercel/Supabase integration.\n" +
    "The app will use read-only local content and will not create community data."
  );
}

// comportamento desejado. Nada de conteudo fica aqui — progresso de leitura,
// The BFF owns authenticated sessions in protected HttpOnly cookies. This
// public client is used only by local development fallbacks and never receives
// or persists a session token.
// Remove sessoes antigas que ficaram no localStorage de versoes anteriores,
// para que um login velho nao "ressuscite" ao trocar de aba.
if (typeof window !== "undefined") {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("sb-") && key.includes("auth-token"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage bloqueado (modo restrito): nao ha o que limpar.
  }
}

export function isSupabaseReady() {
  return Boolean(supabaseUrl && supabasePublicKey);
}
