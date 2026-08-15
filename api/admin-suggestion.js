import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  PERMISSIONS,
  requirePermission,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
} from "../server/supabase.js";
import { parseAdminSuggestionInput } from "../src/lib/api-contracts.js";

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

    const { action, suggestionId, status } = parseAdminSuggestionInput(req.body);

    if (action === "move") {
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
        return sendClientError(req, res, 404, "Sugestao nao encontrada");
      }

      logAuditEvent("suggestion.move", req, {
        actorId: user.id,
        targetId: suggestionId,
        outcome: "success",
      });
      return sendSuccess(req, res, updated);
    }

    if (action === "delete") {
      await supabaseRequest(
        `suggestions?id=eq.${encodeURIComponent(suggestionId)}`,
        { method: "DELETE" }
      );

      logAuditEvent("suggestion.delete", req, {
        actorId: user.id,
        targetId: suggestionId,
        outcome: "success",
      });
      return sendSuccess(req, res, { id: suggestionId });
    }

    return sendClientError(req, res, 400, "Acao invalida");
  } catch (error) {
    logServerError("admin_suggestion", error, req);
    return sendError(req, res, error, "Erro ao atualizar sugestao");
  }
}
