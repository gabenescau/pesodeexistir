import { isSupabaseReady } from "@/app/data/supabase";
import { authenticatedApiPost } from "./authenticated-api";

const FUNCTION_NAME = "secure-upload";

export async function secureUpload({ file, bucket, kind }) {
  if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
  if (!(file instanceof File)) throw new Error("Arquivo invalido.");

  const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const publicKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publicKey) throw new Error("Supabase nao configurado.");

  const ticketData = await authenticatedApiPost("/api/auth?action=upload-ticket", {
    bucket,
    kind,
    fileName: file.name || "arquivo",
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  });
  if (!ticketData?.ticket) throw new Error("Nao foi possivel autorizar o upload.");

  const form = new FormData();
  form.append("file", file, file.name || "arquivo");
  form.append("bucket", bucket);
  form.append("kind", kind);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
      method: "POST",
      headers: {
        apikey: publicKey,
        "x-upload-ticket": ticketData.ticket,
      },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("O upload demorou mais que o permitido. Tente um arquivo menor.");
    }
    throw new Error("Nao foi possivel conectar ao servico de upload.");
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || (response.status >= 500
      ? "O servico de upload esta temporariamente indisponivel."
      : "O arquivo nao foi aceito pelo servidor."));
  }

  if (!data?.path) throw new Error("O arquivo nao foi aceito pelo servidor.");
  return data.path;
}
