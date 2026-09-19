function normalizeSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    const error = new Error("APP_URL invalida. Use uma URL HTTPS completa.");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }

  const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (![
    "https:",
    ...(localHost ? ["http:"] : []),
  ].includes(parsed.protocol)) {
    const error = new Error("APP_URL deve usar HTTPS.");
    error.status = 503;
    error.userSafe = true;
    throw error;
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configured = process.env.APP_URL || process.env.VITE_APP_URL;
  if (configured) return normalizeSiteUrl(configured);
  if (process.env.VERCEL_URL) return normalizeSiteUrl(process.env.VERCEL_URL);
  return "http://localhost:5173";
}
