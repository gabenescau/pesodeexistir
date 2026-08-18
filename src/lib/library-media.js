import { isSupabaseReady } from "@/app/data/supabase";
import { secureUpload } from "./secure-upload";
import { authenticatedApiPost } from "./authenticated-api";

export const LIBRARY_BUCKETS = {
  covers: "covers",
  pdfs: "pdfs",
  shopMedia: "shop-media",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateLibraryFile(file, kind) {
  if (!file) throw new Error("Selecione um arquivo.");

  if (kind === "image") {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Use uma imagem JPG, PNG, WebP ou GIF.");
    }
    if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no maximo 5 MB.");
    return;
  }

  if (file.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (file.size > MAX_PDF_BYTES) throw new Error("O PDF deve ter no maximo 50 MB.");
}

export async function uploadLibraryFile({ file, bucket, kind }) {
  const validationKind = bucket === LIBRARY_BUCKETS.pdfs ? "pdf" : "image";
  validateLibraryFile(file, validationKind);
  return secureUpload({ file, bucket, kind });
}

export async function removeLibraryFile(bucket, path) {
  if (!isSupabaseReady() || !path) return;
  await authenticatedApiPost("/api/auth?action=upload-delete", { bucket, paths: [path] });
}

export async function removeUploadedFiles(bucket, paths) {
  if (!isSupabaseReady() || !paths?.length) return;
  await authenticatedApiPost("/api/auth?action=upload-delete", { bucket, paths });
}

export async function createSignedUrlMap(bucket, paths, expiresIn = 3600) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!isSupabaseReady() || uniquePaths.length === 0) return new Map();

  try {
    const data = await authenticatedApiPost("/api/admin-data", {
      operation: "signed-media",
      payload: { bucket, paths: uniquePaths, expiresIn },
    });
    return new Map(Object.entries(data || {}));
  } catch {
    return new Map();
  }
}
