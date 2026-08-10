import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

// ---------------------------------------------------------------------------
// Cliente do sistema de XP / Creditos OPE / Loja.
// Toda escrita de saldo acontece no banco via RPCs server-authoritative. Este
// modulo so encaminha chamadas e normaliza o retorno jsonb — nunca grava saldo.
// ---------------------------------------------------------------------------

// Curva de nivel espelhada no banco (private.xp_threshold): cumulative XP
// para alcancar o nivel n. Deterministica, nunca gravada como dado.
export function xpThreshold(level) {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.6));
}

export function levelFromXp(xp) {
  let level = 1;
  while (level < 200 && xpThreshold(level + 1) <= Math.max(0, xp || 0)) {
    level += 1;
  }
  return level;
}

export const DAILY_CAPS = { xp: 120, credits: 30 };

const REWARD_TABLE = {
  login: { xp: 5, credits: 1, limit: "1x/dia" },
  reading15: { xp: 15, credits: 5, limit: "por sessão" },
  reading30: { xp: 15, credits: 5, limit: "1x/dia" },
  post: { xp: 20, credits: 3, limit: "2x/dia" },
  comment: { xp: 10, credits: 2, limit: "5x/dia" },
  like_received: { xp: 2, credits: 1, limit: "20x/dia" },
  daily_mission: { xp: 80, credits: 15, limit: "1x/dia" },
  weekly_mission: { xp: 200, credits: 40, limit: "1x/semana" },
  referral: { xp: 500, credits: 100, limit: "por indicação" },
};

export function rewardMeta(key) {
  return REWARD_TABLE[key] || null;
}

async function rpc(name, args = {}) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase não configurado.");
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(getSupabaseErrorMessage(error));
  return data ?? null;
}

export const rewardApi = {
  rewardLogin: () => rpc("reward_login"),
  reportReading: (bookId, seconds, interacted) =>
    rpc("report_reading_session", { p_book_id: bookId, p_seconds: seconds, p_interacted: interacted }),
  rewardPost: (userId, sourceRef) =>
    rpc("reward_post", { p_user_id: userId, p_source_ref: sourceRef }),
  rewardComment: (userId, text) =>
    rpc("reward_comment", { p_user_id: userId, p_text: text }),
  rewardLikesReceived: (ownerId) =>
    rpc("reward_likes_received", { p_owner_id: ownerId }),
  completeDailyMission: () => rpc("complete_daily_mission"),
  completeWeeklyMission: () => rpc("complete_weekly_mission"),
  redeemProduct: (productId, customerName, customerEmail, address) =>
    rpc("redeem_product", {
      p_product_id: productId,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_address: address,
    }),
  referralClaim: (referredUserId) =>
    rpc("referral_claim", { p_referred_user_id: referredUserId }),
  getMyReferralCode: () => rpc("get_my_referral_code"),
  registerReferral: (code) => rpc("register_referral", { p_referrer_code: code }),
  walletState: () => rpc("wallet_state"),
  monthlyRanking: (limit = 20) => rpc("monthly_ranking", { p_limit: limit }),
};

// Normaliza o jsonb de wallet retornado pelo banco em objeto tipado seguro.
export function normalizeWalletState(raw) {
  if (!raw) return null;
  return {
    xp: Number(raw.xp || 0),
    credits: Number(raw.credits || 0),
    level: Number(raw.level || 1),
    levelXp: Number(raw.levelXp || 0),
    nextLevelXp: Number(raw.nextLevelXp || 0),
    levelProgress: Math.max(0, Math.min(1, Number(raw.levelProgress ?? 0))),
    streak: {
      current: Number(raw.streak?.current || 0),
      best: Number(raw.streak?.best || 0),
      lastDay: raw.streak?.lastDay || null,
    },
    today: {
      xp: Number(raw.today?.xp || 0),
      credits: Number(raw.today?.credits || 0),
      readingSec: Number(raw.today?.readingSec || 0),
      login: Number(raw.today?.login || 0),
      post: Number(raw.today?.post || 0),
      comment: Number(raw.today?.comment || 0),
      likeReceived: Number(raw.today?.likeReceived || 0),
    },
    missions: {
      daily: {
        done: Boolean(raw.missions?.daily?.done),
        objectives: {
          login: Boolean(raw.missions?.daily?.objectives?.login),
          reading30: Boolean(raw.missions?.daily?.objectives?.reading30),
          post: Boolean(raw.missions?.daily?.objectives?.post),
          comments: Boolean(raw.missions?.daily?.objectives?.comments),
        },
      },
      weekly: {
        done: Boolean(raw.missions?.weekly?.done),
        streakNeeded: Number(raw.missions?.weekly?.streakNeeded || 7),
      },
    },
  };
}