import { supabase, isSupabaseReady } from "@/app/data/supabase";

const FUNCTION_NAME = "secure-upload";

export async function secureUpload({ file, bucket, kind }) {
  if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
  if (!(file instanceof File)) throw new Error("Arquivo invalido.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) throw new Error("Sessao expirada. Entre novamente.");

  const form = new FormData();
  form.append("file", file, file.name || "arquivo");
  form.append("bucket", bucket);
  form.append("kind", kind);

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: form,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    let message = error.message || "Nao foi possivel validar o arquivo.";
    try {
      const context = await error.context?.json?.();
      message = context?.error || message;
    } catch {
      // Mantem a mensagem generica quando a Edge Function nao retorna JSON.
    }
    throw new Error(message);
  }

  if (!data?.path) throw new Error("O arquivo nao foi aceito pelo servidor.");
  return data.path;
}
