import {
  allowAuthRequest,
  enforceRateLimit,
  getAuthenticatedUser,
  sendClientError,
  sendError,
  sendSuccess,
} from "../server/supabase.js";
import {
  getAuthenticatedProfile,
  getRequiredCookieSession,
  loginWithPassword,
  logoutAuthenticatedUser,
  parseEmailBody,
  parseLoginBody,
  parseProfileUpdateBody,
  parseSignupBody,
  parseUpdateUserBody,
  resendSignupEmail,
  signupWithPassword,
  updateAuthenticatedUser,
  updateAuthenticatedProfile,
} from "../server/auth.js";
import { getActiveSeasonCatalog, getPublicCatalog } from "../server/catalog.js";
import { getCommunityFeed, handleCommunityWrite } from "../server/community.js";
import { getReadingProgress, updateReadingProgress } from "../server/reading.js";
import { handleRewardsAction } from "../server/rewards.js";
import { getMySubscriptions } from "../server/billing.js";
import { deleteUploadedFiles } from "../server/upload.js";
import { getAccountState, handleAccountWrite } from "../server/account.js";
import { handleSuggestionsAction } from "../server/suggestions.js";
import { getRetrospective } from "../server/retrospective.js";

function actionFromRequest(req) {
  const action = String(req.query?.action || "session").trim().toLowerCase();
  return action || "session";
}

function actionMethod(action, req) {
  if (action === "reading") return req.method === "GET" ? "GET" : "POST";
  if (action === "suggestions") return req.method === "GET" ? "GET" : "POST";
  if (action === "community-write") return "POST";
  if (action === "account-write") return "POST";
  return action === "session" || action === "profile" || action === "catalog" || action === "season" || action === "community" || action === "wallet" || action === "store" || action === "redemptions" || action === "referrals" || action === "subscription" || action === "account-state" || action === "retrospective"
    ? "GET"
    : "POST";
}

export default async function handler(req, res) {
  const action = actionFromRequest(req);
  const method = actionMethod(action, req);
  const publicAuthAction = ["session", "login", "signup", "resend"].includes(action);
  if (!allowAuthRequest(req, res, {
    method,
    // Login, cadastro, reenvio e restauracao de sessao sao endpoints publicos.
    // CORS, rate limit e a propria autenticacao continuam sendo aplicados;
    // um cabecalho customizado nao pode ser tratado como controle de acesso,
    // pois navegadores, WebViews e gerenciadores de senha podem omiti-lo.
    requireHeader: !publicAuthAction,
  })) return;

  try {
    if (action === "session") {
      try {
        const session = await getRequiredCookieSession(req, res);
        return sendSuccess(req, res, {
          user: session.user,
        });
      } catch (error) {
        if (error?.status === 401) {
          return sendClientError(req, res, 401, "Sessao ausente ou expirada.");
        }
        throw error;
      }
    }

    if (action === "profile") {
      return sendSuccess(req, res, await getAuthenticatedProfile(req, res));
    }

    if (action === "catalog") {
      if (!await enforceRateLimit(req, res, {
        scope: "public_catalog",
        limit: 60,
        windowSeconds: 60,
      })) return;
      res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
      return sendSuccess(req, res, await getPublicCatalog(req));
    }

    if (action === "season") {
      if (!await enforceRateLimit(req, res, { scope: "public_season", limit: 60, windowSeconds: 60 })) return;
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      return sendSuccess(req, res, await getActiveSeasonCatalog(req, res));
    }

    if (action === "community") {
      if (!await enforceRateLimit(req, res, {
        scope: "community_feed",
        limit: 30,
        windowSeconds: 60,
      })) return;
      res.setHeader("Cache-Control", "private, no-store");
      return sendSuccess(req, res, await getCommunityFeed(req, res));
    }

    if (action === "community-write") {
      return sendSuccess(req, res, await handleCommunityWrite(req, res));
    }

    if (action === "suggestions") {
      return await handleSuggestionsAction(req, res);
    }

    if (action === "subscription") {
      const user = await getAuthenticatedUser(req, res);
      if (!await enforceRateLimit(req, res, {
        scope: "my_subscriptions",
        limit: 30,
        windowSeconds: 60,
        userId: user.id,
      })) return;
      res.setHeader("Cache-Control", "private, no-store");
      return sendSuccess(req, res, await getMySubscriptions(req, res));
    }

    if (action === "account-state") {
      return sendSuccess(req, res, await getAccountState(req, res));
    }

    if (action === "retrospective") {
      const user = await getAuthenticatedUser(req, res);
      if (!await enforceRateLimit(req, res, {
        scope: "retrospective",
        limit: 6,
        windowSeconds: 300,
        userId: user.id,
      })) return;
      res.setHeader("Cache-Control", "private, no-store");
      return sendSuccess(req, res, await getRetrospective(req, res));
    }

    if (action === "account-write") {
      return sendSuccess(req, res, await handleAccountWrite(req, res));
    }

    if (action === "upload-delete") {
      const user = await getAuthenticatedUser(req, res);
      if (!await enforceRateLimit(req, res, {
        scope: "upload_delete",
        limit: 30,
        windowSeconds: 300,
        userId: user.id,
      })) return;
      return sendSuccess(req, res, await deleteUploadedFiles(req, res));
    }

    if (action === "reading") {
      const user = await getAuthenticatedUser(req, res);
      if (!await enforceRateLimit(req, res, {
        scope: "reading_progress",
        limit: req.method === "GET" ? 60 : 30,
        windowSeconds: 60,
        userId: user.id,
      })) return;
      if (req.method === "GET") {
        return sendSuccess(req, res, await getReadingProgress(req, res));
      }
      return sendSuccess(req, res, await updateReadingProgress(req, res, req.body));
    }

    if (action === "wallet" || action === "store" || action === "redemptions" || action === "referrals" || action === "reward") {
      res.setHeader("Cache-Control", action === "store" ? "private, max-age=15, stale-while-revalidate=60" : "no-store");
      return sendSuccess(req, res, await handleRewardsAction(req, res, action));
    }

    if (action === "login") {
      const input = parseLoginBody(req.body);
      if (!await enforceRateLimit(req, res, {
        scope: "auth_login",
        limit: 8,
        windowSeconds: 300,
      })) return;
      return sendSuccess(req, res, await loginWithPassword(res, input));
    }

    if (action === "signup") {
      const input = parseSignupBody(req.body);
      if (!await enforceRateLimit(req, res, {
        scope: "auth_signup",
        limit: 5,
        windowSeconds: 900,
      })) return;
      return sendSuccess(req, res, await signupWithPassword(res, input));
    }

    if (action === "resend") {
      const input = parseEmailBody(req.body);
      if (!await enforceRateLimit(req, res, {
        scope: "auth_resend",
        limit: 3,
        windowSeconds: 900,
      })) return;
      await resendSignupEmail(input);
      return sendSuccess(req, res, { sent: true });
    }

    if (action === "update-user") {
      return sendSuccess(req, res, await updateAuthenticatedUser(
        req,
        res,
        parseUpdateUserBody(req.body),
      ));
    }

    if (action === "update-profile") {
      return sendSuccess(req, res, await updateAuthenticatedProfile(
        req,
        res,
        parseProfileUpdateBody(req.body),
      ));
    }

    if (action === "logout-others") {
      await logoutAuthenticatedUser(req, res, "others");
      return sendSuccess(req, res, { loggedOut: true });
    }

    if (action === "logout") {
      await logoutAuthenticatedUser(req, res, "local");
      return sendSuccess(req, res, { loggedOut: true });
    }

    return sendClientError(req, res, 404, "Operacao de autenticacao desconhecida.");
  } catch (error) {
    const fallback = action === "login"
      ? "Nao foi possivel entrar agora. Tente novamente em alguns minutos."
      : action === "signup"
        ? "Nao foi possivel criar sua conta agora. Tente novamente em alguns minutos."
        : action === "resend"
          ? "Nao foi possivel reenviar a confirmacao agora."
          : action === "logout-others"
            ? "Nao foi possivel encerrar outras sessoes."
            : action === "update-user"
              ? "Nao foi possivel atualizar os dados da conta."
              : action === "update-profile"
                ? "Nao foi possivel atualizar o perfil."
              : action === "catalog"
                ? "Nao foi possivel carregar o catalogo agora."
              : action === "season"
                ? "Nao foi possivel carregar a season agora."
              : action === "community"
                ? "Nao foi possivel carregar a comunidade agora."
              : action === "community-write"
                ? "Nao foi possivel concluir a interacao agora."
              : action === "suggestions"
                ? "Nao foi possivel concluir a operacao nas sugestoes."
              : action === "account-write"
                ? "Nao foi possivel atualizar seus dados agora."
              : action === "subscription"
                ? "Nao foi possivel carregar sua assinatura agora."
              : action === "account-state"
                ? "Nao foi possivel carregar seus dados agora."
              : action === "retrospective"
                ? "Nao foi possivel carregar sua retrospectiva agora."
              : action === "upload-delete"
                ? "Nao foi possivel remover o arquivo agora."
              : action === "wallet"
                ? "Nao foi possivel atualizar sua carteira agora."
              : action === "store"
                ? "Nao foi possivel carregar a loja agora."
              : action === "redemptions"
                ? "Nao foi possivel carregar seus resgates agora."
                : action === "referrals"
                  ? "Nao foi possivel carregar suas indicacoes agora."
              : action === "reward"
                ? "Nao foi possivel concluir essa recompensa agora."
              : "Nao foi possivel concluir a autenticacao.";
    return sendError(req, res, error, fallback);
  }
}
