import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

// Cliente do sistema de creditos OPE. O saldo e sempre decidido pelos RPCs.
export const DAILY_CAPS = { credits: 20 };

const REWARD_TABLE = {
  login: { credits: 1, limit: "1x/dia" },
  reading15: { credits: 5, limit: "por sessao" },
  reading30: { credits: 5, limit: "1x/dia" },
  post: { credits: 3, limit: "2x/dia" },
  comment: { credits: 2, limit: "5x/dia" },
  like_received: { credits: 1, limit: "20x/dia" },
  daily_mission: { credits: 15, limit: "1x/dia" },
  weekly_mission: { credits: 40, limit: "1x/semana" },
  referral: { credits: 100, limit: "por indicacao" },
};

export function rewardMeta(key) {
  return REWARD_TABLE[key] || null;
}

async function rpc(name, args = {}) {
  if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(getSupabaseErrorMessage(error));
  return data ?? null;
}

export const rewardApi = {
  rewardLogin: () => rpc("reward_login"),
  reportReading: (bookId, seconds, interacted) => rpc("report_reading_session", { p_book_id: bookId, p_seconds: seconds, p_interacted: interacted }),
  rewardPost: (userId, sourceRef) => rpc("reward_post", { p_user_id: userId, p_source_ref: sourceRef }),
  rewardComment: (userId, text) => rpc("reward_comment", { p_user_id: userId, p_text: text }),
  rewardLikesReceived: (ownerId) => rpc("reward_likes_received", { p_owner_id: ownerId }),
  completeDailyMission: () => rpc("complete_daily_mission"),
  completeWeeklyMission: () => rpc("complete_weekly_mission"),
  redeemProduct: (productId, customerName, customerEmail, address, idempotencyKey, variantId = null, quantity = 1) => rpc("redeem_product_with_variant", {
    p_product_id: productId,
    p_variant_id: variantId,
    p_quantity: quantity,
    p_customer_name: customerName,
    p_customer_email: customerEmail,
    p_address: { ...(address && typeof address === "object" ? address : {}), idempotency_key: idempotencyKey || globalThis.crypto?.randomUUID?.() || `redeem-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  }),
  referralClaim: (referredUserId) => rpc("referral_claim", { p_referred_user_id: referredUserId }),
  getMyReferralCode: () => rpc("get_my_referral_code"),
  registerReferral: (code) => rpc("register_referral", { p_referrer_code: code }),
  walletState: () => rpc("wallet_state"),
  creditsRanking: (limit = 10) => rpc("credits_ranking", { p_limit: limit }),
};

export function normalizeWalletState(raw) {
  if (!raw) return null;
  return {
    credits: Number(raw.credits || 0),
    streak: { current: Number(raw.streak?.current || 0), best: Number(raw.streak?.best || 0), lastDay: raw.streak?.lastDay || null },
    today: {
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
      weekly: { done: Boolean(raw.missions?.weekly?.done), streakNeeded: Number(raw.missions?.weekly?.streakNeeded || 7) },
    },
  };
}
