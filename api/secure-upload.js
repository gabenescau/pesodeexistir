import {
  allowAuthRequest,
  getCookieSession,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import { uploadUploadedFile } from "../server/upload.js";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "60mb",
  },
};

export default async function handler(req, res) {
  if (!allowAuthRequest(req, res, { method: "POST", requireHeader: true })) return;

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 52 * 1024 * 1024) {
    res.status(413).json({ success: false, error: "Payload muito grande" });
    return;
  }

  try {
    const session = await getCookieSession(req, res);
    if (!session?.user || !session.accessToken) {
      res.status(401).json({ success: false, error: "Sessao invalida ou expirada." });
      return;
    }
    const request = new Request(`https://${req.headers.host || "localhost"}${req.url || "/api/secure-upload"}`, {
      method: req.method,
      headers: req.headers,
      body: req,
      duplex: "half",
    });
    const form = await request.formData();
    return sendSuccess(req, res, await uploadUploadedFile(req, res, form, session));
  } catch (error) {
    return sendError(req, res, error, "Nao foi possivel concluir o upload.");
  }
}
