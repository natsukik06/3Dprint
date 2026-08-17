export const CREDIT_PRICE_YEN = 100;
export const MAX_DISCOUNTABLE_CREDITS = 3;

export const CREDIT_PACKS = [
  { id: "pack-5", credits: 5, priceYen: 500 },
  { id: "pack-10", credits: 10, priceYen: 1000 },
  { id: "pack-30", credits: 30, priceYen: 3000 },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
