const inFlightUploads = new Map();

function uploadKey(file, bucket, kind) {
  return [bucket, kind, file.name, file.size, file.lastModified].join(":");
}

async function uploadOnce({ file, bucket, kind }) {
  if (!(file instanceof File)) throw new Error("Arquivo invalido.");

  const form = new FormData();
  form.append("file", file, file.name || "arquivo");
  form.append("bucket", bucket);
  form.append("kind", kind);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch("/api/uploads", {
      method: "POST",
      credentials: "include",
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
    const message = data?.error || (response.status >= 500
      ? "O servico de upload esta temporariamente indisponivel."
      : "O arquivo nao foi aceito pelo servidor.");
    throw new Error(message);
  }

  const uploadedPath = data?.data?.path || data?.path;
  if (!uploadedPath) throw new Error("O arquivo nao foi aceito pelo servidor.");
  return uploadedPath;
}

export function secureUpload({ file, bucket, kind }) {
  if (!(file instanceof File)) return uploadOnce({ file, bucket, kind });

  const key = uploadKey(file, bucket, kind);
  const current = inFlightUploads.get(key);
  if (current) return current;

  const request = uploadOnce({ file, bucket, kind })
    .finally(() => inFlightUploads.delete(key));
  inFlightUploads.set(key, request);
  return request;
}
