import { isActiveSubscription } from "./subscription";
import { planInfoFromCode } from "./plans";

// IDs in this matrix must correspond to a real server-side rule or product
// capability. The pricing UI consumes the same catalog.
export const PLAN_FEATURES = Object.freeze({
  leitor: Object.freeze([
    "library",
    "community",
    "reading_rewards",
    "store",
    "reading_sync",
    "weekly_releases",
    "missions",
  ]),
  pensador: Object.freeze([
    "library",
    "community",
    "reading_rewards",
    "store",
    "reading_sync",
    "weekly_releases",
    "verified_badge",
    "ranking",
    "seasons",
    "credit_multiplier",
    "vip_support",
    "early_drops",
  ]),
});

export function getSubscriptionTier(subscription) {
  if (!isActiveSubscription(subscription)) return null;
  const planCode = subscription?.plan || subscription?.metadata?.plan;
  return planInfoFromCode(planCode)?.tier || null;
}

export function hasPlanFeature({ isAdmin, subscription, feature } = {}) {
  if (isAdmin) return true;
  if (!feature) return Boolean(isActiveSubscription(subscription));
  const tier = getSubscriptionTier(subscription);
  return Boolean(tier && PLAN_FEATURES[tier]?.includes(feature));
}

export function canUsePaidSocialFeatures({ isAdmin, subscription } = {}) {
  return hasPlanFeature({ isAdmin, subscription });
}
