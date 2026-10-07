export const CREDIT_PRICE_YEN = 100;
// 5ポーズセット: credits spent per pose that is turned into a 3D model (5 poses = 10 credits). The other
// products spend 1 credit per model.
export const POSE_SET_CREDITS_PER_POSE = 2;
export const MAX_DISCOUNTABLE_CREDITS = 2;
// The generation fee only comes back (as a discount at checkout) when the merchandise subtotal --
// before shipping and discounts -- reaches this. Below it the order simply isn't discounted and the
// customer's credit balance is left untouched for a later, bigger order (see calculateEstimate and
// /api/order-checkout).
export const GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN = 1000;

// A single extra shape-preview generation, once the free daily allowance (2/day, see
// checkAndConsumeFreeGeneration in src/lib/credits.ts) is used up -- for customers who want to
// try several poses before committing to a full (¥100/credit) 3D model.
export const PREVIEW_CREDIT_PRICE_YEN = 50;

export const CREDIT_PACKS = [
  { id: "pack-5", credits: 5, priceYen: 500 },
  { id: "pack-10", credits: 10, priceYen: 1000 },
  { id: "pack-30", credits: 30, priceYen: 3000 },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

// Upper bound for a custom (non-pack) credit purchase -- guards against fat-finger or abusive
// quantities. Well above the largest pack (30) so it never gets in a genuine bulk buyer's way.
export const MAX_CUSTOM_CREDITS = 200;
