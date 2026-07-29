import { isActiveSubscription } from "./subscription";

export function canUsePaidSocialFeatures({ isAdmin, subscription } = {}) {
  return Boolean(isAdmin || isActiveSubscription(subscription));
}
