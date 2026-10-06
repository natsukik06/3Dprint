import {
  CREDIT_PRICE_YEN,
  GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN,
  MAX_DISCOUNTABLE_CREDITS,
} from "@/lib/creditPacks";
import {
  MAGIC_COLOR_OPTIONS,
  SOLID_SIZE_OPTIONS,
  type ColorQuantities,
  type MagicColor,
  type Pose,
  type SceneLayout,
  type SizeOption,
  type SolidSizeOption,
  type SubjectType,
} from "@/types/order";

// Base price for the first M (中空/hollowed) unit in a set; each additional M unit adds
// ADDITIONAL_UNIT_PRICE_YEN. Raised from ¥800/¥400 after actually hand-producing a batch made
// clear how labor-intensive hollowing (water-draining, hand-finishing) really is.
export const FIGURE_PRICE_YEN = 2000;
export const ADDITIONAL_UNIT_PRICE_YEN = 1000;
// Solid (中実) sizes -- flat per-piece pricing, no quantity-discount ladder, since they skip
// hollowing entirely and are priced by size alone. Replaces the original SS/S/L lineup.
export const SOLID_PRICE_YEN: Record<SolidSizeOption, number> = {
  // Added as the lowest-priced entry size so a first-time buyer can try the shop for less.
  solid20: 300,
  solid30: 400,
  solid35: 500,
  solid40: 600,
  // 50mm+ aren't on sale yet (see AVAILABLE_SIZE_OPTIONS) -- priced high on purpose: they're made
  // in small nightly batches, so they should be a rarer, premium product, not a volume line.
  solid50: 1800,
  solid60: 2800,
  solid70: 4000,
};
// Per physical piece -- covers the eye-pin/clasp hardware itself plus the extra hand-drilling and
// assembly work, while staying a small enough add-on to keep it an easy upsell.
export const HARDWARE_ADDON_PRICE_YEN = 50;
// Per physical piece -- covers picking/positioning a 3D-text font in the slicer and the extra
// slice/print verification per order, on top of the hardware addon's own labor.
export const ENGRAVING_PRICE_YEN = 300;
export const SHIPPING_FEE_YEN = 330;
export const FREE_SHIPPING_SUBTOTAL_YEN = 2200;
// Friend-referral reward: both the referrer and the new customer they referred get this much off
// their next order's merchandise subtotal (not shipping), once, when claimed via a referral link
// on new account signup -- see src/lib/referral.ts.
export const REFERRAL_DISCOUNT_RATE = 0.1;
// The referral discount only applies when the item subtotal reaches this -- on a single small
// piece it would eat most of the margin.
export const REFERRAL_MIN_SUBTOTAL_YEN = 1500;

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

export const SCENE_LAYOUT_LABELS: Record<SceneLayout, string> = {
  sideBySide: "並んで",
  snuggled: "寄り添って",
  stacked: "重なって",
};

export const MAGIC_COLOR_LABELS: Record<MagicColor, string> = {
  starryBlue: "星空ブルー",
  nebulaPink: "ネビュラピンク",
  clearAurora: "クリアオーロラ",
  galaxyGreen: "ギャラクシーグリーン",
  cometOrange: "コメットオレンジ",
  cosmicPurple: "コズミックパープル",
  marsRed: "マーズレッド",
  furCavity: "毛入れ用（空洞・コルク栓付き）",
  pureClear: "ピュアクリスタル",
  smokeOnyx: "クリアブラック",
  stardustBlack: "スターダストブラック",
  pureBlack: "真っ黒",
  pureWhite: "真っ白",
  clearBlue: "クリアブルー",
  clearRed: "クリアレッド",
  clearYellow: "クリアイエロー",
  clearPink: "クリアピンク",
  clearGreen: "クリアグリーン",
  clearPurple: "クリアパープル",
  clearOrange: "クリアオレンジ",
  frosted: "フロスト（すりガラス風・コーティングなし）",
};

function isSolidSize(size: SizeOption): size is SolidSizeOption {
  return (SOLID_SIZE_OPTIONS as readonly SizeOption[]).includes(size);
}

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
    wantsEngraving: boolean;
  }[];
  generationCreditsUsed?: number;
  referralDiscountActive?: boolean;
  // Per-color, per-size add-on, admin-editable via /admin/colors (see src/lib/colorSettings.ts)
  // -- e.g. a premium color might cost more on a bigger piece than a smaller one. Omitted/missing
  // colors or sizes add ¥0, so every existing caller that doesn't pass this keeps behaving
  // exactly as before.
  colorPriceYen?: Partial<Record<MagicColor, Partial<Record<SizeOption, number>>>>;
};

export type Estimate = {
  quantity: number;
  subtotalYen: number;
  shippingYen: number;
  discountYen: number;
  referralDiscountYen: number;
  totalPriceYen: number;
};

// M (中空/hollowed) is priced on its own quantity-discount ladder; each solid (中実) size is
// priced flat per piece with no ladder, since it's simply a labor-light, fixed-price item. A set
// mixing M with solid pieces sums (M's ladder total) + (flat solid total), not one shared ladder.
export function calculateEstimate({
  items,
  generationCreditsUsed = 0,
  referralDiscountActive = false,
  colorPriceYen = {},
}: EstimateInput): Estimate {
  const mQuantity = items
    .filter((item) => item.sizeOption === "M")
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const solidQuantity = items
    .filter((item) => isSolidSize(item.sizeOption))
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const quantity = mQuantity + solidQuantity;
  if (quantity === 0) {
    return {
      quantity: 0,
      subtotalYen: 0,
      shippingYen: 0,
      discountYen: 0,
      referralDiscountYen: 0,
      totalPriceYen: 0,
    };
  }
  const mPriceYen =
    mQuantity > 0
      ? FIGURE_PRICE_YEN + (mQuantity - 1) * ADDITIONAL_UNIT_PRICE_YEN
      : 0;
  const solidPriceYen = items
    .filter((item) => isSolidSize(item.sizeOption))
    .reduce(
      (sum, item) =>
        sum +
        SOLID_PRICE_YEN[item.sizeOption as SolidSizeOption] *
          getTotalQuantity(item.colorQuantities),
      0
    );
  // Charged per physical piece, not per item -- an item with 3 colors and hardware requested
  // needs the hole/clasp added to all 3 physical figures.
  const hardwareQuantity = items
    .filter((item) => item.wantsHardware)
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const hardwarePriceYen = hardwareQuantity * HARDWARE_ADDON_PRICE_YEN;
  const engravingQuantity = items
    .filter((item) => item.wantsEngraving)
    .reduce((sum, item) => sum + getTotalQuantity(item.colorQuantities), 0);
  const engravingPriceYen = engravingQuantity * ENGRAVING_PRICE_YEN;
  // Per-unit color surcharge -- charged once per physical piece, same basis as hardware/engraving
  // above, not folded into the M ladder (a premium color costs the same extra whether it's the
  // 1st or 5th unit in the set). Priced per size (see ColorSetting.priceYenBySize), since a color
  // can cost more to produce on a bigger piece than a smaller one.
  const colorSurchargeYen = items.reduce(
    (sum, item) =>
      sum +
      MAGIC_COLOR_OPTIONS.reduce(
        (colorSum, color) =>
          colorSum +
          (colorPriceYen[color]?.[item.sizeOption] ?? 0) * (item.colorQuantities[color] ?? 0),
        0
      ),
    0
  );
  const subtotalYen =
    mPriceYen + solidPriceYen + hardwarePriceYen + engravingPriceYen + colorSurchargeYen;
  const shippingYen = subtotalYen >= FREE_SHIPPING_SUBTOTAL_YEN ? 0 : SHIPPING_FEE_YEN;
  // 3Dモデル生成代（生成クレジット）の割引は、商品小計が GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN
  // （¥1,000）以上のときだけ適用する。サイズは問わない（小さいサイズだけでも¥1,000以上なら対象）。
  const discountYen =
    subtotalYen < GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN
      ? 0
      : Math.min(generationCreditsUsed, MAX_DISCOUNTABLE_CREDITS) * CREDIT_PRICE_YEN;
  const referralDiscountYen = referralDiscountActive && subtotalYen >= REFERRAL_MIN_SUBTOTAL_YEN
    ? Math.round(subtotalYen * REFERRAL_DISCOUNT_RATE)
    : 0;

  return {
    quantity,
    subtotalYen,
    shippingYen,
    discountYen,
    referralDiscountYen,
    totalPriceYen: Math.max(
      0,
      subtotalYen + shippingYen - discountYen - referralDiscountYen
    ),
  };
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}
