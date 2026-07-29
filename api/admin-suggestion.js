import { allowPost, getAuthenticatedUser, requireAdmin, supabaseRequest } from "./_server.js";

const VALID_STATUSES = new Set(["ideas", "reading", "building", "released"]);

export default async function handler(req, res) {
  try {
    if (!allowPost(req, res)) return;

    const user = await getAuthenticatedUser(req);
    await requireAdmin(user);

    const { action, suggestionId, status } = req.body || {};
    if (action !== "move") {
      return res.status(400).json({ success: false, error: "Acao invalida" });
    }
    if (!suggestionId || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, error: "Sugestao ou coluna invalida" });
    }

    const rows = await supabaseRequest(
      `suggestions?id=eq.${encodeURIComponent(suggestionId)}`,
      {
        method: "PATCH",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify({
          status,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    const updated = rows?.[0];
    if (!updated) {
      return res.status(404).json({ success: false, error: "Sugestao nao encontrada" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("admin-suggestion error:", error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Erro ao atualizar sugestao",
    });
  }
}
