const REQUIRED_SERVER_ENV_GROUPS = [
  ["SUPABASE_URL"],
  ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  ["SUPABASE_PUBLISHABLE_KEY"],
  ["STRIPE_SECRET_KEY"],
  ["STRIPE_WEBHOOK_SECRET"],
  ["CRON_SECRET"],
];

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ status: "error", error: "Metodo nao permitido" });
  }

  const missingConfiguration = REQUIRED_SERVER_ENV_GROUPS.some(
    (alternatives) => !alternatives.some((name) => process.env[name])
  );
  const payload = {
    status: missingConfiguration ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
  };

  if (req.method === "HEAD") {
    return res.status(missingConfiguration ? 503 : 200).end();
  }
  return res.status(missingConfiguration ? 503 : 200).json(payload);
}
