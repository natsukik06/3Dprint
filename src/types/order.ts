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
  "furCavity",
] as const;
export const HARDWARE_COLOR_OPTIONS = ["silver", "gold", "roseGold", "clear"] as const;
// A-Z, engraved into the underside of the piece during hollowing (see functions/src's
// engraveInitial) so a physical piece can never be mixed up with another order's piece or
// color once it's off the shared print plate and out of colorless resin -- the customer's own
// choice of letter travels with the object itself, not just a paper work sheet.
export const INITIAL_OPTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;
// What's being reproduced -- affects which detail-note fields are shown, the AI prompt wording
// (fur/anatomy language only makes sense for "pet"), and whether the pose picker is shown at all
// ("object" always reproduces the pose as photographed, since a mug doesn't sit/stand/lie down).
export const SUBJECT_TYPE_OPTIONS = ["pet", "object"] as const;
export const SIZE_OPTIONS = ["S", "M", "L"] as const;
// Launch sells S (2.8cm) and M (4cm) only. L stays fully wired up server-side
// (scaling/shipping/pricing) for when it's reintroduced -- only the
// customer-facing size picker is restricted.
export const AVAILABLE_SIZE_OPTIONS = ["S", "M"] as const satisfies readonly (typeof SIZE_OPTIONS)[number][];
// Per-piece production lifecycle (each set item is printed/finished independently).
export const ORDER_STATUS_OPTIONS = ["pending", "batched", "completed"] as const;
export const PAYMENT_STATUS_OPTIONS = ["unpaid", "paid"] as const;

export type SubjectType = (typeof SUBJECT_TYPE_OPTIONS)[number];
export type Pose = (typeof POSE_OPTIONS)[number];
export type MagicColor = (typeof MAGIC_COLOR_OPTIONS)[number];
export type ColorQuantities = Record<MagicColor, number>;
export type PetDetails = {
  furColorNote?: string;
  breedNote?: string;
  accessoryNote?: string;
  bodyFeatureNote?: string;
};
export type HardwareColor = (typeof HARDWARE_COLOR_OPTIONS)[number];
export type Initial = (typeof INITIAL_OPTIONS)[number];
export type SizeOption = (typeof SIZE_OPTIONS)[number];
export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number];
export type BoundingBoxMm = { x: number; y: number; z: number };

export const SIZE_TARGET_MM: Record<SizeOption, number> = { S: 28, M: 40, L: 50 };
export const SHIPPING_METHOD_BY_SIZE: Record<SizeOption, string> = {
  S: "クリックポスト",
  M: "クリックポスト",
  L: "宅急便コンパクト",
};
export const HARDWARE_COLOR_LABELS: Record<HardwareColor, string> = {
  silver: "シルバー",
  gold: "ゴールド",
  roseGold: "ローズゴールド",
  clear: "目印チャーム",
};
export const SIZE_LABELS: Record<SizeOption, string> = {
  S: "Sサイズ（最大辺2.8cm・クリックポスト配送）",
  M: "Mサイズ（最大辺4cm・クリックポスト配送）",
  L: "Lサイズ（最大辺5cm・宅急便コンパクト配送）",
};
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "未処理",
  batched: "バッチ割当済み",
  completed: "完了",
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

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
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
    furCavity: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
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
        v.furCavity;
      return total >= 1 && total <= MAX_TOTAL_QUANTITY;
    },
    { error: `合計1〜${MAX_TOTAL_QUANTITY}個の範囲で指定してください` }
  );

// One generated figure within a set: everything needed to reproduce and price it. Captured into
// the `items` array when the customer clicks "セットに追加"; the top-level draft fields below
// (subject, pose, sizeOption, ...) are just the in-progress builder for the item not yet added.
const orderItemSchema = z.object({
  subjectType: z.enum(SUBJECT_TYPE_OPTIONS),
  subject: z.string().min(1, "何を作りたいか入力してください"),
  furColorNote: z.string().max(200, "200文字以内で入力してください").optional(),
  breedNote: z.string().max(200, "200文字以内で入力してください").optional(),
  accessoryNote: z.string().max(200, "200文字以内で入力してください").optional(),
  bodyFeatureNote: z
    .string()
    .max(200, "200文字以内で入力してください")
    .optional(),
  pose: z.enum(POSE_OPTIONS),
  sizeOption: z.enum(SIZE_OPTIONS),
  colorQuantities: colorQuantitiesSchema,
  wantsHardware: z.boolean(),
  hardwareColor: z.enum(HARDWARE_COLOR_OPTIONS),
  chainPositionNote: z.string().max(200, "200文字以内で入力してください").optional(),
  // Engraved into the piece during hollowing -- see INITIAL_OPTIONS above.
  initial: z.enum(INITIAL_OPTIONS),
  referenceImageUrls: z.array(z.string()),
  modelUrl: z.string().min(1, "3Dモデルが生成されていません"),
  finishedPreviewUrls: z.record(z.string(), z.string()),
  // True when modelUrl came from the customer's own upload rather than AI generation --
  // referenceImageUrls/finishedPreviewUrls are empty in that case, which is expected, not missing.
  isCustomModel: z.boolean(),
});

export const orderFormSchema = z.object({
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
  sizeOption: z.enum(SIZE_OPTIONS, "サイズを選択してください"),
  colorQuantities: colorQuantitiesSchema,
  wantsHardware: z.boolean(),
  hardwareColor: z.enum(HARDWARE_COLOR_OPTIONS),
  chainPositionNote: z.string().max(200, "200文字以内で入力してください").optional(),
  initial: z.enum(INITIAL_OPTIONS, "イニシャルを選択してください"),
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
  // Optional -- does not block ordering. Lets the customer allow (or refuse) their generated
  // model/photos being used in the shop's own showcase (site gallery, SNS), separate from the
  // required legal consents above.
  agreeShowcase: z.boolean(),
  // Optional, separate affirmative opt-in for promotional email (price drops, campaigns).
  // Required to be its own unambiguous checkbox under Japan's 特定電子メール法 -- never bundle
  // this consent with another one or default it to true.
  agreeMarketingEmail: z.boolean(),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderItemDraft = z.infer<typeof orderItemSchema>;

// One order document per checkout/shipment: pricing, shipping, and customer info are aggregated
// across all items. Production tracking (scaling, hollowing, batching) happens per physical piece
// in the separate `order_items` collection, created by fanning out `items` once payment succeeds.
export type OrderRecord = {
  items: OrderItemDraft[];
  estimatedPriceYen: number;
  shippingYen: number;
  discountYen: number;
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
  // Whether the A5 packing-slip/thank-you insert has been printed for this order (see
  // /admin/slips) -- tracked separately from production status since it's a packing-desk task,
  // not a fabrication one.
  insertPrinted: boolean;
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
