export async function loadPublicCatalog({ only = "all", booksOffset = 0, authorsOffset = 0 } = {}) {
  const params = new URLSearchParams({
    action: "catalog",
    only,
    booksOffset: String(booksOffset),
    authorsOffset: String(authorsOffset),
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
    const error = new Error(payload?.error || "Nao foi possivel carregar o catalogo.");
    error.status = response.status;
    throw error;
  }
  return payload?.data || {};
}

export async function loadActiveSeasonCatalog() {
  const response = await fetch("/api/auth?action=season", {
    credentials: "include",
    headers: { Accept: "application/json", "X-Requested-With": "OPE-Auth" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || "Nao foi possivel carregar a season.");
    error.status = response.status;
    throw error;
  }
  return payload?.data || { season: null, products: [] };
}
