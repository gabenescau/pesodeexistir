import {
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  prepareResponse,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
} from "../server/supabase.js";
import { parseSuggestionLikeInput } from "../src/lib/api-contracts.js";

async function readCounts(suggestionId = null) {
  const filter = suggestionId ? `&suggestion_id=eq.${encodeURIComponent(suggestionId)}` : "";
  return supabaseRequest(`suggestion_like_counts?select=suggestion_id,like_count${filter}`) || [];
}

export default async function handler(req, res) {
  prepareResponse(req, res);
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return sendClientError(req, res, 405, "Metodo nao permitido");
    }

    const user = await getAuthenticatedUser(req);
    if (!await enforceRateLimit(req, res, {
      scope: "suggestion_likes",
      limit: 60,
      windowSeconds: 300,
      userId: user.id,
    })) return;

    if (req.method === "GET") {
      const [likedRows, countRows] = await Promise.all([
        supabaseRequest(`suggestion_likes?user_id=eq.${encodeURIComponent(user.id)}&select=suggestion_id&limit=5000`),
        readCounts(),
      ]);
      return sendSuccess(req, res, {
        likedIds: (likedRows || []).map((row) => row.suggestion_id),
        counts: countRows || [],
      });
    }

    const { suggestionId } = parseSuggestionLikeInput(req.body);
    const existing = await supabaseRequest(
      `suggestion_likes?suggestion_id=eq.${encodeURIComponent(suggestionId)}&user_id=eq.${encodeURIComponent(user.id)}&select=suggestion_id&limit=1`
    );
    const liked = Array.isArray(existing) && existing.length > 0;

    if (liked) {
      await supabaseRequest(
        `suggestion_likes?suggestion_id=eq.${encodeURIComponent(suggestionId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
      );
    } else {
      await supabaseRequest("suggestion_likes", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ suggestion_id: suggestionId, user_id: user.id }),
      });
    }

    const countRows = await readCounts(suggestionId);
    const likeCount = Number(countRows?.[0]?.like_count || 0);
    logAuditEvent("suggestion.like", req, {
      actorId: user.id,
      targetId: suggestionId,
      outcome: liked ? "removed" : "added",
    });
    return sendSuccess(req, res, { liked: !liked, likeCount });
  } catch (error) {
    logServerError("suggestion_likes", error, req);
    return sendError(req, res, error, "Nao foi possivel atualizar a curtida");
  }
}
