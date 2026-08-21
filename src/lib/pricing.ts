import { CREDIT_PRICE_YEN, MAX_DISCOUNTABLE_CREDITS } from "@/lib/creditPacks";
import {
  MAGIC_COLOR_OPTIONS,
  type ColorQuantities,
  type DeliveryTimeSlot,
  type MagicColor,
  type Pose,
} from "@/types/order";

export const FIGURE_PRICE_YEN = 1500;
export const ADDITIONAL_UNIT_PRICE_YEN = 400;
export const SHIPPING_FEE_YEN = 700;
export const FREE_SHIPPING_MIN_QUANTITY = 3;

export const POSE_LABELS: Record<Pose, string> = {
  sitting: "お座り",
  standing: "立ち姿",
  lying: "寝そべり",
  asPhoto: "写真のまま",
  auto: "おまかせ",
};

export const MAGIC_COLOR_LABELS: Record<MagicColor, string> = {
  starryBlue: "星空ブルー（青＋銀ラメ）",
  galaxyGreen: "ギャラクシーグリーン（暗闇で光る・蓄光ラメ）",
  clearAurora: "クリアオーロラ",
  furCavity: "毛入れ用（空洞・コルク栓付き）",
};

export const DELIVERY_TIME_SLOT_LABELS: Record<DeliveryTimeSlot, string> = {
  none: "指定なし",
  morning: "午前中",
  "12-14": "12:00〜14:00",
  "14-16": "14:00〜16:00",
  "16-18": "16:00〜18:00",
  "18-20": "18:00〜20:00",
  "19-21": "19:00〜21:00",
};

export function getTotalQuantity(colorQuantities: ColorQuantities): number {
  return MAGIC_COLOR_OPTIONS.reduce(
    (sum, color) => sum + (colorQuantities[color] ?? 0),
    0
  );
}

export type EstimateInput = {
  items: { colorQuantities: ColorQuantities }[];
  generationCreditsUsed?: number;
};

export type Estimate = {
  quantity: number;
  subtotalYen: number;
  shippingYen: number;
  discountYen: number;
  totalPriceYen: number;
};

// Every unit counts the same toward the quantity discount and free-shipping threshold, whichever
// item/model/size it belongs to -- a set of 3 different figures gets exactly the same discount as
// 3 of the same figure. This falls out of reusing the existing single-item formula across the
// whole set's combined quantity, so mixed sets aren't a new pricing tier.
export function calculateEstimate({
  items,
  generationCreditsUsed = 0,
}: EstimateInput): Estimate {
  const quantity = items.reduce(
    (sum, item) => sum + getTotalQuantity(item.colorQuantities),
    0
  );
  if (quantity === 0) {
    return { quantity: 0, subtotalYen: 0, shippingYen: 0, discountYen: 0, totalPriceYen: 0 };
  }
  const subtotalYen =
    FIGURE_PRICE_YEN + (quantity - 1) * ADDITIONAL_UNIT_PRICE_YEN;
  const shippingYen = quantity >= FREE_SHIPPING_MIN_QUANTITY ? 0 : SHIPPING_FEE_YEN;
  const discountYen =
    Math.min(generationCreditsUsed, MAX_DISCOUNTABLE_CREDITS) *
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
