import {
  allowPost,
  enforceRateLimit,
  getAuthenticatedUser,
  logAuditEvent,
  logServerError,
  PERMISSIONS,
  prepareResponse,
  requirePermission,
  sendClientError,
  sendError,
  sendSuccess,
  supabaseRequest,
} from "./supabase.js";
import {
  parseAdminSuggestionInput,
  parseSuggestionLikeInput,
} from "../src/lib/api-contracts.js";

async function readCounts(suggestionId = null) {
  const filter = suggestionId ? `&suggestion_id=eq.${encodeURIComponent(suggestionId)}` : "";
  return supabaseRequest(`suggestion_like_counts?select=suggestion_id,like_count${filter}`) || [];
}

async function handleLikes(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendClientError(req, res, 405, "Metodo nao permitido");
  }
  const user = await getAuthenticatedUser(req, res);
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
    `suggestion_likes?suggestion_id=eq.${encodeURIComponent(suggestionId)}&user_id=eq.${encodeURIComponent(user.id)}&select=suggestion_id&limit=1`,
  );
  const liked = Array.isArray(existing) && existing.length > 0;
  if (liked) {
    await supabaseRequest(
      `suggestion_likes?suggestion_id=eq.${encodeURIComponent(suggestionId)}&user_id=eq.${encodeURIComponent(user.id)}`,
      { method: "DELETE" },
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
}

async function handleBoard(req, res) {
  const user = await getAuthenticatedUser(req, res);
  if (!await enforceRateLimit(req, res, {
    scope: "suggestions_board",
    limit: req.method === "GET" ? 60 : 20,
    windowSeconds: 60,
    userId: user.id,
  })) return;
  if (req.method === "GET") {
    const rows = await supabaseRequest(
      "suggestions?select=id,user_id,title,description,category,status,author_name,comment_count,created_at,updated_at&order=created_at.desc&limit=500",
    );
    return sendSuccess(req, res, rows || []);
  }
  if (!allowPost(req, res)) return;
  const body = req.body || {};
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 90) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 40) : "Geral";
  if (title.length < 3) return sendClientError(req, res, 400, "Titulo da sugestao invalido.");
  const rows = await supabaseRequest("suggestions?select=id,user_id,title,description,category,status,author_name,comment_count,created_at,updated_at&limit=1", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      title,
      description,
      category: category || "Geral",
      status: "ideas",
      author_name: typeof body.authorName === "string" ? body.authorName.trim().slice(0, 80) || "Leitor" : "Leitor",
    }),
  });
  return sendSuccess(req, res, rows?.[0] || null, 201);
}

async function handleAdmin(req, res) {
  if (!allowPost(req, res)) return;
  const user = await getAuthenticatedUser(req, res);
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
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      },
    );
    const updated = rows?.[0];
    if (!updated) return sendClientError(req, res, 404, "Sugestao nao encontrada");
    logAuditEvent("suggestion.move", req, { actorId: user.id, targetId: suggestionId, outcome: "success" });
    return sendSuccess(req, res, updated);
  }

  if (action === "delete") {
    await supabaseRequest(
      `suggestions?id=eq.${encodeURIComponent(suggestionId)}`,
      { method: "DELETE" },
    );
    logAuditEvent("suggestion.delete", req, { actorId: user.id, targetId: suggestionId, outcome: "success" });
    return sendSuccess(req, res, { id: suggestionId });
  }
  return sendClientError(req, res, 400, "Acao invalida");
}

export async function handleSuggestionsAction(req, res) {
  prepareResponse(req, res);
  try {
    const action = String(req.query?.suggestionAction || "likes").toLowerCase();
    if (action === "board") return await handleBoard(req, res);
    if (action === "admin") return await handleAdmin(req, res);
    return await handleLikes(req, res);
  } catch (error) {
    logServerError("suggestions", error, req);
    return sendError(req, res, error, "Nao foi possivel concluir a operacao.");
  }
}
