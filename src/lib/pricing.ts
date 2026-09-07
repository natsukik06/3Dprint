import { CREDIT_PRICE_YEN, MAX_DISCOUNTABLE_CREDITS } from "@/lib/creditPacks";
import {
  MAGIC_COLOR_OPTIONS,
  type ColorQuantities,
  type MagicColor,
  type Pose,
  type SizeOption,
  type SubjectType,
} from "@/types/order";

// Base price for the first non-S unit in a set; each additional non-S unit adds
// ADDITIONAL_UNIT_PRICE_YEN. S has its own, cheaper base/additional pair below.
export const FIGURE_PRICE_YEN = 800;
export const ADDITIONAL_UNIT_PRICE_YEN = 400;
export const SMALL_SIZE_PRICE_YEN = 300;
export const SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN = 200;
// Per physical piece -- covers the eye-pin/clasp hardware itself plus the extra hand-drilling and
// assembly work, while staying a small enough add-on to keep it an easy upsell.
export const HARDWARE_ADDON_PRICE_YEN = 50;
export const SHIPPING_FEE_YEN = 700;
export const FREE_SHIPPING_SUBTOTAL_YEN = 2200;

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  pet: "ペット",
  object: "モノ・思い出の品",
};

export const POSE_LABELS: Record<Pose, string> = {
  sitting: "お座り",
  standing: "立ち姿",
  lying: "寝そべり",
  asPhoto: "写真のまま",
  auto: "おまかせ",
};

export const MAGIC_COLOR_LABELS: Record<MagicColor, string> = {
  starryBlue: "星空ブルー（青＋銀ラメ）",
  nebulaPink: "ネビュラピンク（ピンク＋銀ラメ）",
  clearAurora: "クリアオーロラ",
  galaxyGreen: "ギャラクシーグリーン（緑＋蓄光ラメ）",
  cometOrange: "コメットオレンジ（オレンジ＋金ラメ）",
  cosmicPurple: "コズミックパープル（紫＋ラメ）",
  furCavity: "毛入れ用（空洞・コルク栓付き）",
};

export function getTotalQuantity(colorQuantities: ColorQuantities): number {
  return MAGIC_COLOR_OPTIONS.reduce(
    (sum, color) => sum + (colorQuantities[color] ?? 0),
    0
  );
}

export type EstimateInput = {
  items: {
    sizeOption: SizeOption;
    colorQuantities: ColorQuantities;
    wantsHardware: boolean;
  }[];
  generationCreditsUsed?: number;
};

export type Estimate = {
  quantity: number;
  subtotalYen: number;
  shippingYen: number;
  discountYen: number;
  totalPriceYen: number;
};

// S and non-S (M/L) units are priced on separate quantity-discount ladders and then summed --
// e.g. 1 S + 1 M in a set is priced as (S's own 1st-unit rate) + (M's own 1st-unit rate), not as
// "2 units on one ladder". Within each ladder, every unit counts the same toward that ladder's
// ADDITIONAL_UNIT_PRICE_YEN, whichever item/model it belongs to.
export function calculateEstimate({
  items,
  generationCreditsUsed = 0,
}: EstimateInput): Estimate {
  const smallQuantity = items
    .filter((item) => item.sizeOption === "S")
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const otherQuantity = items
    .filter((item) => item.sizeOption !== "S")
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const quantity = smallQuantity + otherQuantity;
  if (quantity === 0) {
    return { quantity: 0, subtotalYen: 0, shippingYen: 0, discountYen: 0, totalPriceYen: 0 };
  }
  const smallPriceYen =
    smallQuantity > 0
      ? SMALL_SIZE_PRICE_YEN +
        (smallQuantity - 1) * SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN
      : 0;
  const otherPriceYen =
    otherQuantity > 0
      ? FIGURE_PRICE_YEN + (otherQuantity - 1) * ADDITIONAL_UNIT_PRICE_YEN
      : 0;
  // Charged per physical piece, not per item -- an item with 3 colors and hardware requested
  // needs the hole/clasp added to all 3 physical figures.
  const hardwareQuantity = items
    .filter((item) => item.wantsHardware)
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const hardwarePriceYen = hardwareQuantity * HARDWARE_ADDON_PRICE_YEN;
  const subtotalYen = smallPriceYen + otherPriceYen + hardwarePriceYen;
  const shippingYen = subtotalYen >= FREE_SHIPPING_SUBTOTAL_YEN ? 0 : SHIPPING_FEE_YEN;
  // Sサイズだけの注文には生成クレジット利用割引を適用しない -- 薄利のため他サイズの割引と重ねない。
  // 他サイズが1個でも含まれていれば通常通り割引される。
  const discountYen =
    otherQuantity === 0
      ? 0
      : Math.min(generationCreditsUsed, MAX_DISCOUNTABLE_CREDITS) *
        CREDIT_PRICE_YEN;

  return {
    quantity,
    subtotalYen,
    shippingYen,
    discountYen,
    totalPriceYen: Math.max(0, subtotalYen + shippingYen - discountYen),
  };
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}
