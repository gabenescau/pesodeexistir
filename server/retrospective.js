import { getRequiredCookieSession } from "./auth.js";
import { supabaseUserRequest } from "./supabase.js";

export async function getRetrospective(req, res) {
  const session = await getRequiredCookieSession(req, res);
  return supabaseUserRequest(session.accessToken, "rpc/retrospective_snapshot", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
