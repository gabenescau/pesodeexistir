export async function loadCommunityFeed({ offset = 0 } = {}) {
  const params = new URLSearchParams({
    action: "community",
    offset: String(offset),
  });
  const response = await fetch(`/api/auth?${params.toString()}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "OPE-Auth",
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || "Nao foi possivel carregar a comunidade.");
    error.status = response.status;
    throw error;
  }
  return payload?.data || {};
}
