import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  PERMISSIONS,
  requirePermission,
  requireUuid,
  sendError,
  supabaseRequest,
} from "../server/supabase.js";

const VALID_STATUSES = new Set(["ideas", "reading", "building", "released"]);

export default async function handler(req, res) {
  try {
    if (!allowPost(req, res)) return;

    const user = await getAuthenticatedUser(req);
    await requirePermission(user, PERMISSIONS.MANAGE_SUGGESTIONS);
    if (!await enforceRateLimit(req, res, {
      scope: "admin_suggestion",
      limit: 60,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    const { action, suggestionId, status } = req.body || {};
    if (action !== "move") {
      return res.status(400).json({ success: false, error: "Acao invalida" });
    }
    requireUuid(suggestionId, "suggestionId");
    if (!VALID_STATUSES.has(status)) {
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

    logAuditEvent("suggestion.move", req, {
      actorId: user.id,
      targetId: suggestionId,
      outcome: "success",
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logServerError("admin_suggestion", error, req);
    return sendError(req, res, error, "Erro ao atualizar sugestao");
  }
}
