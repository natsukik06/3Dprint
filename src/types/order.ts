import { z } from "zod";

export const POSE_OPTIONS = [
  "sitting",
  "standing",
  "lying",
  "asPhoto",
  "auto",
] as const;
export const MAGIC_COLOR_OPTIONS = [
  "starryBlue",
  "nebulaPink",
  "clearAurora",
  "galaxyGreen",
  "cometOrange",
  "cosmicPurple",
  "marsRed",
  "furCavity",
  "pureClear",
  "smokeOnyx",
  "stardustBlack",
  "pureBlack",
  "pureWhite",
  // Translucent single-tint "clear" resins -- the launch lineup (smokeOnyx is sold as クリアブラック).
  // The mixed ones (pink/green/purple/orange) are blends of the base tints, kept disabled by
  // default so turning one on from /admin/colors is all it takes, with no code change.
  "clearBlue",
  "clearRed",
  "clearYellow",
  "clearPink",
  "clearGreen",
  "clearPurple",
  "clearOrange",
  // The print left uncoated after an alcohol wipe: a cloudy, frosted-glass look that shows the
  // sculpted fur detail well (no clear coat step, so it's also the quickest to produce).
  "frosted",
] as const;
// The glow-in-the-dark (蓄光) colors -- the thank-you insert only explains how to charge/glow them
// for orders that actually contain one.
export const GLOW_COLOR_OPTIONS = [
  "starryBlue",
  "nebulaPink",
  "clearAurora",
  "galaxyGreen",
  "cometOrange",
  "cosmicPurple",
  "marsRed",
] as const satisfies readonly (typeof MAGIC_COLOR_OPTIONS)[number][];
export const HARDWARE_COLOR_OPTIONS =["silver", "gold", "roseGold", "clear"] as const;
// "おそろいセット" -- two pets sculpted together into ONE figurine (one physical piece, one
// order item), instead of two separate figures. How they're arranged relative to each other --
// see figureGridPromptDuo in src/lib/gemini.ts for what each actually asks the AI to draw.
export const SCENE_LAYOUT_OPTIONS = ["sideBySide", "snuggled", "stacked"] as const;
// What's being reproduced -- affects which detail-note fields are shown, the AI prompt wording
// (fur/anatomy language only makes sense for "pet"), and whether the pose picker is shown at all
// ("object" always reproduces the pose as photographed, since a mug doesn't sit/stand/lie down).
export const SUBJECT_TYPE_OPTIONS = ["pet", "object"] as const;
// Shape/sculpting style for AI-generated models -- "deformed" is the cute chibi/toy-figurine look
// (the shop's default aesthetic, see ちゃろ), "realistic" keeps true-to-life proportions instead.
// Only affects the AI generation prompt (see figureGridPrompt/generateFinishedPreview in
// src/lib/gemini.ts) -- duo mode and the pose-set flow are still deformed-only for now.
export const MODEL_STYLE_OPTIONS = ["deformed", "realistic"] as const;
// Two product lines with very different labor cost, discovered after actually hand-producing a
// batch: "M" is hollowed (中空) -- water-drained, sculpted with a fill hole -- while the other
// four are solid (中実) all the way through, which skips that whole step. Solid can't take the
// furCavity ("毛入れ用") color for the same reason -- there's no cavity to pack fur into. SS/S/L
// from the original launch lineup are retired in favor of this split.
export const SIZE_OPTIONS = [
  "solid30",
  "solid35",
  "solid40",
  "solid50",
  "solid60",
  "solid70",
  "M",
] as const;
// What customers can actually pick right now. The 50/60/70mm sizes are fully defined (price,
// scaling, shipping, weekly cap) but held back from the launch -- they'll be made in batches at
// night in small numbers, at higher prices, once the 30-40mm lineup is running smoothly. Add them
// here to switch them on; /api/order-checkout rejects anything not in this list.
// "M" (中空, the 毛入れ用 size) is not sold for now.
export const AVAILABLE_SIZE_OPTIONS = ["solid30", "solid35", "solid40"] as const;
export const SOLID_SIZE_OPTIONS = [
  "solid30",
  "solid35",
  "solid40",
  "solid50",
  "solid60",
  "solid70",
] as const;
// Large pieces (50mm+) are capped separately and low -- see WEEKLY_LARGE_PIECE_CAP in orderCap.ts.
export const LARGE_SIZE_OPTIONS = ["solid50", "solid60", "solid70"] as const;
export type SolidSizeOption = (typeof SOLID_SIZE_OPTIONS)[number];
// The slicer's built-in 3D-text tool reliably turns these into real geometry (its own "Recommended
// Font" list); anything else risks its "local fonts may not generate 3D" failure mode, so the
// customer-facing font picker is restricted to just these.
export const ENGRAVING_FONT_OPTIONS = [
  "Arial",
  "Arial Black",
  "Arial Narrow",
  "Arial Rounded MT Bold",
  "Comic Sans MS",
  "Georgia",
  "Times New Roman",
] as const;
export const MAX_ENGRAVING_TEXT_LENGTH = 20;
// Per-piece production lifecycle (each set item is printed/finished independently).
export const ORDER_STATUS_OPTIONS = ["pending", "batched", "completed"] as const;
export const PAYMENT_STATUS_OPTIONS = ["unpaid", "paid"] as const;

export type SubjectType = (typeof SUBJECT_TYPE_OPTIONS)[number];
export type ModelStyle = (typeof MODEL_STYLE_OPTIONS)[number];
export type Pose = (typeof POSE_OPTIONS)[number];
export type SceneLayout = (typeof SCENE_LAYOUT_OPTIONS)[number];
export type MagicColor = (typeof MAGIC_COLOR_OPTIONS)[number];
export type ColorQuantities = Record<MagicColor, number>;
export type PetDetails = {
  furColorNote?: string;
  breedNote?: string;
  accessoryNote?: string;
  bodyFeatureNote?: string;
};
export type HardwareColor = (typeof HARDWARE_COLOR_OPTIONS)[number];
export type HardwareAssignments = Partial<Record<MagicColor, Partial<Record<HardwareColor, number>>>>;
export type EngravingFont = (typeof ENGRAVING_FONT_OPTIONS)[number];
export type SizeOption = (typeof SIZE_OPTIONS)[number];
export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number];
export type BoundingBoxMm = { x: number; y: number; z: number };

export const SIZE_TARGET_MM: Record<SizeOption, number> = {
  solid30: 30,
  solid35: 35,
  solid40: 40,
  solid50: 50,
  solid60: 60,
  solid70: 70,
  M: 40,
};
// 40mm is the largest that's expected to fit クリックポスト's 3cm thickness limit once packed --
// measure a real packed piece before relying on it (see the QA checklist's shipping section).
export const SHIPPING_METHOD_BY_SIZE: Record<SizeOption, string> = {
  solid30: "クリックポスト",
  solid35: "クリックポスト",
  solid40: "クリックポスト",
  M: "クリックポスト",
  solid50: "宅急便コンパクト",
  solid60: "宅急便コンパクト",
  solid70: "宅急便コンパクト",
};
export const HARDWARE_COLOR_LABELS: Record<HardwareColor, string> = {
  silver: "シルバー",
  gold: "ゴールド",
  roseGold: "ローズゴールド",
  clear: "目印チャーム",
};
// "30mm" / "M" -- the short form for labels and emails (the raw ids like "solid30" are internal).
export function sizeShortLabel(size: SizeOption): string {
  return size === "M" ? "M" : `${size.replace("solid", "")}mm`;
}

export const SIZE_LABELS: Record<SizeOption, string> = {
  solid30: "30mmサイズ（最大辺3.0cm・中実・クリックポスト配送）",
  solid35: "35mmサイズ（最大辺3.5cm・中実・クリックポスト配送）",
  solid40: "40mmサイズ（最大辺4.0cm・中実・クリックポスト配送）",
  solid50: "50mmサイズ（最大辺5.0cm・中実・宅急便コンパクト配送）",
  solid60: "60mmサイズ（最大辺6.0cm・中実・宅急便コンパクト配送）",
  solid70: "70mmサイズ（最大辺7.0cm・中実・宅急便コンパクト配送）",
  M: "毛入れ用 Mサイズ（最大辺4cm・中空・クリックポスト配送）",
};
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "未処理",
  batched: "バッチ割当済み",
  completed: "完了",
};
export const MODEL_STYLE_LABELS: Record<ModelStyle, string> = {
  deformed: "デフォルメ（かわいいトイ風）",
  realistic: "実写風（写真そのままの見た目）",
};

// Shipping methods ranked from most- to least-compact. When a set mixes sizes, the whole
// shipment must use the method required by its bulkiest item — e.g. one L-size item forces
// 宅急便コンパクト for the entire package even if every other item is S/M. Extend this list (in
// order) if a new, bulkier shipping method is ever added.
const SHIPPING_METHOD_PRIORITY = ["クリックポスト", "宅急便コンパクト"] as const;

export function determineShippingMethod(
  items: { sizeOption: SizeOption }[]
): string {
  let best: (typeof SHIPPING_METHOD_PRIORITY)[number] = SHIPPING_METHOD_PRIORITY[0];
  for (const item of items) {
    const method = SHIPPING_METHOD_BY_SIZE[item.sizeOption] as (typeof SHIPPING_METHOD_PRIORITY)[number];
    if (SHIPPING_METHOD_PRIORITY.indexOf(method) > SHIPPING_METHOD_PRIORITY.indexOf(best)) {
      best = method;
    }
  }
  return best;
}

// Default fill-port diameter — used both for the admin's own epoxy-fill
// syringe port and for the "furCavity" product's cork stopper (the customer
// inserts their pet's own fur and reseals it). 8mm matches a commonly
// available miniature-bottle cork stopper (~7-12.5mm); provisional until a
// specific stopper product is sourced and confirmed by test-fit.
export const DEFAULT_BOTTOM_HOLE_DIAMETER_MM = 8;
// Fixed diameter for the top hardware hole (ヒートン金具用).
export const HARDWARE_HOLE_DIAMETER_MM = 3;
// Diameter for the automatically-placed drain/vent hole added when hollowing
// a model that has no customer-specified hole (so the cavity is never sealed).
export const DEFAULT_DRAIN_HOLE_DIAMETER_MM = 2;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Own-model bring-in: the file still goes through the same server-side scaling/hollowing
// pipeline as an AI-generated model (which expects a GLB), so the size cap here is purely a
// storage/upload-time guard, not a physical-size limit -- physical size is still controlled by
// the S/M sizeOption, which rescales whatever model (AI or customer-made) to that size's target
// dimension.
export const MAX_CUSTOM_MODEL_SIZE_BYTES = 30 * 1024 * 1024;
export const MAX_REFERENCE_PHOTOS = 5;
export const MAX_TOTAL_QUANTITY = 10;
// Distinct models/subjects allowed in one set. Matches the real packaging constraint discussed
// for a single クリックポスト-compatible parcel (arranged on card stock + bubble wrap).
export const MAX_CART_ITEMS = 5;

const imageFileSchema = z
  .instanceof(File, { error: "画像をアップロードしてください" })
  .refine((file) => file.size > 0, "画像をアップロードしてください")
  .refine(
    (file) => file.size <= MAX_IMAGE_SIZE_BYTES,
    "画像サイズは10MB以下にしてください"
  )
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    "JPEG/PNG/WEBP形式の画像を選択してください"
  );

const colorQuantitiesSchema = z
  .object({
    starryBlue: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    nebulaPink: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearAurora: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    galaxyGreen: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    cometOrange: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    cosmicPurple: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    marsRed: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    furCavity: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    pureClear: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    smokeOnyx: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    stardustBlack: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    pureBlack: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    pureWhite: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearBlue: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearRed: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearYellow: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearPink: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearGreen: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearPurple: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearOrange: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    frosted: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
  })
  .refine(
    (v) => {
      const total =
        v.starryBlue +
        v.nebulaPink +
        v.clearAurora +
        v.galaxyGreen +
        v.cometOrange +
        v.cosmicPurple +
        v.marsRed +
        v.furCavity +
        v.pureClear +
        v.smokeOnyx +
        v.stardustBlack +
        v.pureBlack +
        v.pureWhite +
        v.clearBlue +
        v.clearRed +
        v.clearYellow +
        v.clearPink +
        v.clearGreen +
        v.clearPurple +
        v.clearOrange +
        v.frosted;
      return total >= 1 && total <= MAX_TOTAL_QUANTITY;
    },
    { error: `合計1〜${MAX_TOTAL_QUANTITY}個の範囲で指定してください` }
  );

// One generated figure within a set: everything needed to reproduce and price it. Captured into
// the `items` array when the customer clicks "セットに追加"; the top-level draft fields below
// (subject, pose, sizeOption, ...) are just the in-progress builder for the item not yet added.
// Solid (中実) sizes have no cavity, so furCavity ("毛入れ用") can't be ordered for them --
// enforced here (not just in the SpecOptions UI) since order_drafts accepts unauthenticated
// writes with no other field validation (see firestore.rules and the note in order-checkout).
function refineNoFurCavityForSolidSize<
  T extends { sizeOption: SizeOption; colorQuantities: { furCavity: number } },
>(v: T) {
  return !(
    (SOLID_SIZE_OPTIONS as readonly SizeOption[]).includes(v.sizeOption) &&
    v.colorQuantities.furCavity > 0
  );
}
const FUR_CAVITY_SOLID_SIZE_ERROR = {
  error: "小・中・6cm・10cmサイズ（中実）は毛入れ用を選択できません",
  path: ["colorQuantities", "furCavity"] as PropertyKey[],
};

// wantsEngraving just toggles the UI/price on -- the actual text is a separate optional field
// (empty by default so it validates fine while the checkbox is off), so enforce it's non-empty
// only once the customer has actually opted in.
function refineEngravingTextRequired<
  T extends { wantsEngraving: boolean; engravingText?: string },
>(v: T) {
  return !v.wantsEngraving || !!v.engravingText?.trim();
}
const ENGRAVING_TEXT_REQUIRED_ERROR = {
  error: "刻印する文字を入力してください",
  path: ["engravingText"] as PropertyKey[],
};

export const orderItemSchema = z
  .object({
    subjectType: z.enum(SUBJECT_TYPE_OPTIONS),
    subject: z.string().min(1, "入力してください"),
    furColorNote: z.string().max(200, "200文字以内で入力してください").optional(),
    breedNote: z.string().max(200, "200文字以内で入力してください").optional(),
    accessoryNote: z.string().max(200, "200文字以内で入力してください").optional(),
    bodyFeatureNote: z
      .string()
      .max(200, "200文字以内で入力してください")
      .optional(),
    pose: z.enum(POSE_OPTIONS),
    modelStyle: z.enum(MODEL_STYLE_OPTIONS),
    // Opt-in -- a keychain figure doesn't need to stand on its own (it hangs from the hardware),
    // so this is only turned on for customers who also want to display it standing on a shelf.
    wantsSelfStanding: z.boolean(),
    sizeOption: z.enum(SIZE_OPTIONS),
    colorQuantities: colorQuantitiesSchema,
    wantsHardware: z.boolean(),
    hardwareColor: z.enum(HARDWARE_COLOR_OPTIONS),
    chainPositionNote: z.string().max(200, "200文字以内で入力してください").optional(),
    // Customer-chosen name/text engraving (a visible, customer-requested decoration).
    wantsEngraving: z.boolean(),
    engravingText: z
      .string()
      .max(MAX_ENGRAVING_TEXT_LENGTH, `${MAX_ENGRAVING_TEXT_LENGTH}文字以内で入力してください`)
      .optional(),
    engravingFont: z.enum(ENGRAVING_FONT_OPTIONS),
    referenceImageUrls: z.array(z.string()),
    modelUrl: z.string().min(1, "3Dモデルが生成されていません"),
    finishedPreviewUrls: z.record(z.string(), z.string()),
    // True when modelUrl came from the customer's own upload rather than AI generation --
    // referenceImageUrls/finishedPreviewUrls are empty in that case, which is expected, not missing.
    isCustomModel: z.boolean(),
  })
  .refine(refineNoFurCavityForSolidSize, FUR_CAVITY_SOLID_SIZE_ERROR)
  .refine(refineEngravingTextRequired, ENGRAVING_TEXT_REQUIRED_ERROR);

export const orderFormSchema = z
  .object({
  // Current-item draft fields: the in-progress builder for the item about to be added to the
  // set. Loosely validated here (the "セットに追加" button gates real requirements procedurally,
  // e.g. a generated model must exist); `orderItemSchema` above validates what actually lands in
  // `items` below, which is the real submission payload.
  photos: z
    .array(imageFileSchema)
    .max(MAX_REFERENCE_PHOTOS, `写真は${MAX_REFERENCE_PHOTOS}枚までです`),
  subjectType: z.enum(SUBJECT_TYPE_OPTIONS),
  subject: z.string(),
  furColorNote: z.string().max(200, "200文字以内で入力してください").optional(),
  breedNote: z.string().max(200, "200文字以内で入力してください").optional(),
  accessoryNote: z.string().max(200, "200文字以内で入力してください").optional(),
  bodyFeatureNote: z
    .string()
    .max(200, "200文字以内で入力してください")
    .optional(),
  pose: z.enum(POSE_OPTIONS, "ポーズを選択してください"),
  modelStyle: z.enum(MODEL_STYLE_OPTIONS),
  wantsSelfStanding: z.boolean(),
  sizeOption: z.enum(SIZE_OPTIONS, "サイズを選択してください"),
  colorQuantities: colorQuantitiesSchema,
  wantsHardware: z.boolean(),
  hardwareColor: z.enum(HARDWARE_COLOR_OPTIONS),
  // Form-only: for each chosen resin color, how many pieces get which strap (金具) color. When the
  // set is added to the cart it is split into one item per strap color (see src/lib/hardwareSplit.ts),
  // so stored items still carry a single hardwareColor each.
  hardwareAssignments: z
    .partialRecord(z.enum(MAGIC_COLOR_OPTIONS), z.partialRecord(z.enum(HARDWARE_COLOR_OPTIONS), z.number().int().min(0)))
    .optional(),
  chainPositionNote: z.string().max(200, "200文字以内で入力してください").optional(),
  wantsEngraving: z.boolean(),
  engravingText: z
    .string()
    .max(MAX_ENGRAVING_TEXT_LENGTH, `${MAX_ENGRAVING_TEXT_LENGTH}文字以内で入力してください`)
    .optional(),
  engravingFont: z.enum(ENGRAVING_FONT_OPTIONS),
  generationCreditsUsed: z.number().int().min(0),

  // The real payload: every item added to the set.
  items: z
    .array(orderItemSchema)
    .min(1, "少なくとも1点をセットに追加してください")
    .max(MAX_CART_ITEMS, `セットに追加できるのは最大${MAX_CART_ITEMS}点までです`),

  customerName: z.string().min(1, "お名前を入力してください"),
  customerEmail: z.email("メールアドレスの形式が正しくありません"),
  postalCode: z.string().min(1, "郵便番号を入力してください"),
  address: z.string().min(1, "住所を入力してください"),
  phoneNumber: z.string().min(1, "電話番号を入力してください"),
  requestNote: z
    .string()
    .max(1000, "1000文字以内で入力してください")
    .optional(),
  agreeCopyright: z.literal(true, "著作権に関する同意が必要です"),
  agreeRisk: z.literal(true, "造形リスクに関する同意が必要です"),
  // Separate from agreeRisk (physical fabrication risk) -- this is about the AI's creative
  // interpretation possibly differing from the customer's mental image, which the preview/retry
  // flow in PreviewPanel already lets them catch before paying, but isn't itself a written
  // consent that "I reviewed and approved this" without an explicit checkbox here.
  agreeAiAccuracy: z.literal(true, "AI生成結果に関する同意が必要です"),
  // Optional -- does not block ordering. Lets the customer allow (or refuse) their generated
  // model/photos being used in the shop's own showcase (site gallery, SNS), separate from the
  // required legal consents above.
  agreeShowcase: z.boolean(),
  // Optional, separate affirmative opt-in for promotional email (price drops, campaigns).
  // Required to be its own unambiguous checkbox under Japan's 特定電子メール法 -- never bundle
  // this consent with another one or default it to true.
  agreeMarketingEmail: z.boolean(),
  })
  .refine(refineNoFurCavityForSolidSize, FUR_CAVITY_SOLID_SIZE_ERROR)
  .refine(refineEngravingTextRequired, ENGRAVING_TEXT_REQUIRED_ERROR);

export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderItemDraft = z.infer<typeof orderItemSchema>;

// One order document per checkout/shipment: pricing, shipping, and customer info are aggregated
// across all items. Production tracking (scaling, hollowing, batching) happens per physical piece
// in the separate `order_items` collection, created by fanning out `items` once payment succeeds.
export type OrderRecord = {
  // Human-facing sequential order number (A00000001, A00000002, ...) -- assigned once, by the
  // Stripe webhook, when a draft is promoted to a real (paid) order; see getNextOrderNumber in
  // src/lib/orderNumber.ts. Optional because orders created before this field existed don't have
  // one -- callers should fall back to the Firestore document id for those.
  orderNumber?: string;
  items: OrderItemDraft[];
  estimatedPriceYen: number;
  shippingYen: number;
  discountYen: number;
  // Raw input behind discountYen -- kept alongside it so /api/order-checkout can re-derive the
  // discount server-side (clamped to MAX_DISCOUNTABLE_CREDITS) instead of trusting the client's
  // pre-computed discountYen, since order_drafts accepts unauthenticated writes with no field
  // validation (see firestore.rules).
  generationCreditsUsed: number;
  shippingMethod: string | null;
  customerName: string;
  customerEmail: string;
  postalCode: string;
  address: string;
  phoneNumber: string;
  requestNote: string;
  agreeShowcase: boolean;
  agreeMarketingEmail: boolean;
  createdAt: unknown;
  paymentStatus: PaymentStatus;
  paidAt: unknown;
  stripeCheckoutSessionId: string | null;
  // Whether the A5 packing-slip/thank-you insert has been printed for this order. The admin page
  // that printed/toggled this (/admin/slips) has been removed; the field is kept as historical
  // data rather than migrated away.
  insertPrinted: boolean;
  // Whether every piece in this order has actually come off the printer -- tracked at order
  // level (not per order_item) since a solo operation prints a whole order's items together in
  // practice; toggled manually from /admin/production, same as shipped below (nothing in the
  // pipeline can detect a physical print finishing on its own).
  printed: boolean;
  printedAt: unknown;
  // Whether this order has actually been handed off for delivery (postbox/post office) --
  // tracked separately from paymentStatus and order_items.status, neither of which say anything
  // about the shipping step itself. Toggled from the admin order list.
  shipped: boolean;
  shippedAt: unknown;
  // The Firebase Auth uid signed in at submission time, if any (checkout itself doesn't require
  // login, but the 3D-generation step does, so most real orders have one). Used only to reset
  // that account's free daily view-generation count once they've actually paid -- see
  // resetFreeGenerations in src/lib/credits.ts.
  uid: string | null;
};

// One physical piece to be printed/finished, fanned out from a paid order's `items[itemIndex]`.
export type OrderItemRecord = OrderItemDraft & {
  orderId: string;
  itemIndex: number;
  customerName: string;
  modelBoundingBoxMm: BoundingBoxMm | null;
  scaledModelUrl: string | null;
  scaledBoundingBoxMm: BoundingBoxMm | null;
  maxDimensionMm: number | null;
  status: OrderStatus;
  batchId: string | null;
  gridId: string | null;
  finishedModelUrl: string | null;
  wallThicknessMm: number | null;
  sphereSegments: number | null;
  hasVentHole: boolean;
  // "manual" = admin hollowed/holed the model themselves outside this app (their own
  // Blender/PrusaSlicer pipeline) and uploaded the result directly, skipping the Cloud
  // Function entirely -- see /api/admin/order-items/[id]/upload-finished.
  ventHoleSource: "auto" | "customer" | "manual" | null;
  createdAt: unknown;
};
