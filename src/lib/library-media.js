import { supabase, isSupabaseReady } from "@/app/data/supabase";

export const LIBRARY_BUCKETS = {
  covers: "covers",
  pdfs: "pdfs",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function safeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function validateLibraryFile(file, kind) {
  if (!file) throw new Error("Selecione um arquivo.");

  if (kind === "image") {
    if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem valida.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no maximo 5 MB.");
    return;
  }

  if (file.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (file.size > MAX_PDF_BYTES) throw new Error("O PDF deve ter no maximo 50 MB.");
}

export async function uploadLibraryFile({ file, bucket, kind }) {
  if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
  validateLibraryFile(file, kind);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (authError || !userId) throw new Error("Sessao expirada. Entre novamente.");

  const fileId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${userId}/${kind}/${fileId}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

export async function removeLibraryFile(bucket, path) {
  if (!isSupabaseReady() || !path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function createSignedUrlMap(bucket, paths, expiresIn = 3600) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!isSupabaseReady() || uniquePaths.length === 0) return new Map();

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(uniquePaths, expiresIn);
  if (error) return new Map();

  return new Map(
    (data || [])
      .filter((item) => item?.path && item?.signedUrl)
      .map((item) => [item.path, item.signedUrl])
  );
}
