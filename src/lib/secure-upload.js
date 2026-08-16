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

  const response = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      "x-upload-ticket": ticketData.ticket,
    },
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Nao foi possivel validar o arquivo.");

  if (!data?.path) throw new Error("O arquivo nao foi aceito pelo servidor.");
  return data.path;
}
