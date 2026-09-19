import {
  allowAuthRequest,
  getRequestQuery,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import { getAdminBootstrap, handleAdminAction } from "../server/admin.js";
import handleAdminSubscription from "../server/admin-subscription.js";

export default async function handler(req, res) {
  if (String(getRequestQuery(req).get("route") || "") === "admin-subscription") {
    return handleAdminSubscription(req, res);
  }
  if (!allowAuthRequest(req, res, {
    method: req.method === "GET" ? "GET" : "POST",
    requireHeader: true,
  })) return;
  try {
    if (req.method === "GET") {
      return sendSuccess(req, res, await getAdminBootstrap(req, res));
    }
    return sendSuccess(req, res, await handleAdminAction(req, res));
  } catch (error) {
    return sendError(req, res, error, "Nao foi possivel concluir a operacao administrativa.");
  }
}
