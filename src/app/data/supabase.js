import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. Set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or SUPABASE_URL/SUPABASE_ANON_KEY.\n" +
    "The app will use read-only local content and will not create community data."
  );
}

// A sessao vive em sessionStorage, nao em localStorage: ela sobrevive a um
// F5 na mesma aba, mas morre quando o usuario fecha a aba/navegador, que e o
// comportamento desejado. Nada de conteudo fica aqui — progresso de leitura,
// notas e perfil moram no banco, entao esta troca nao perde dado nenhum.
// O tema continua em localStorage (theme-provider.jsx): e preferencia, nao sessao.
const authStorage = typeof window !== "undefined" ? window.sessionStorage : undefined;

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

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
      },
    })
  : null;

export function isSupabaseReady() {
  return supabase !== null;
}
