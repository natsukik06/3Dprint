export const CREDIT_PRICE_YEN = 100;
export const MAX_DISCOUNTABLE_CREDITS = 3;

export const CREDIT_PACKS = [
  { id: "pack-5", credits: 5, priceYen: 500 },
  { id: "pack-10", credits: 10, priceYen: 1000 },
  { id: "pack-30", credits: 30, priceYen: 3000 },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

// Upper bound for a custom (non-pack) credit purchase -- guards against fat-finger or abusive
// quantities. Well above the largest pack (30) so it never gets in a genuine bulk buyer's way.
export const MAX_CUSTOM_CREDITS = 200;
