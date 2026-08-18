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
  "galaxyGreen",
  "clearAurora",
] as const;
export const DELIVERY_TIME_SLOT_OPTIONS = [
  "none",
  "morning",
  "12-14",
  "14-16",
  "16-18",
  "18-20",
  "19-21",
] as const;
export const SIZE_OPTIONS = ["S", "L"] as const;
export const ORDER_STATUS_OPTIONS = ["pending", "batched", "completed"] as const;

export type Pose = (typeof POSE_OPTIONS)[number];
export type MagicColor = (typeof MAGIC_COLOR_OPTIONS)[number];
export type DeliveryTimeSlot = (typeof DELIVERY_TIME_SLOT_OPTIONS)[number];
export type ColorQuantities = Record<MagicColor, number>;
export type HolePoint = { x: number; y: number; z: number };
export type SizeOption = (typeof SIZE_OPTIONS)[number];
export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];
export type BoundingBoxMm = { x: number; y: number; z: number };

export const SIZE_TARGET_MM: Record<SizeOption, number> = { S: 28, L: 50 };
export const SHIPPING_METHOD_BY_SIZE: Record<SizeOption, string> = {
  S: "クリックポスト",
  L: "宅急便コンパクト",
};
export const SIZE_LABELS: Record<SizeOption, string> = {
  S: "Sサイズ（最大辺28mm・クリックポスト配送）",
  L: "Lサイズ（最大辺50mm・宅急便コンパクト配送）",
};
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "未処理",
  batched: "バッチ割当済み",
  completed: "完了",
};

export const DEFAULT_BOTTOM_HOLE_DIAMETER_MM = 10;
export const MIN_BOTTOM_HOLE_DIAMETER_MM = 5;
export const MAX_BOTTOM_HOLE_DIAMETER_MM = 25;
// Fixed diameter for the top hardware hole (ヒートン金具用).
export const HARDWARE_HOLE_DIAMETER_MM = 3;
// Diameter for the automatically-placed drain/vent hole added when hollowing
// a model that has no customer-specified hole (so the cavity is never sealed).
export const DEFAULT_DRAIN_HOLE_DIAMETER_MM = 2;

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_REFERENCE_PHOTOS = 5;
export const MAX_TOTAL_QUANTITY = 10;

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
    galaxyGreen: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
    clearAurora: z.number().int().min(0).max(MAX_TOTAL_QUANTITY),
  })
  .refine(
    (v) => {
      const total = v.starryBlue + v.galaxyGreen + v.clearAurora;
      return total >= 1 && total <= MAX_TOTAL_QUANTITY;
    },
    { error: `合計1〜${MAX_TOTAL_QUANTITY}個の範囲で指定してください` }
  );

export const orderFormSchema = z.object({
  photos: z
    .array(imageFileSchema)
    .max(MAX_REFERENCE_PHOTOS, `写真は${MAX_REFERENCE_PHOTOS}枚までです`),
  subject: z.string().min(1, "何を作りたいか入力してください"),
  pose: z.enum(POSE_OPTIONS, "ポーズを選択してください"),
  sizeOption: z.enum(SIZE_OPTIONS, "サイズを選択してください"),
  colorQuantities: colorQuantitiesSchema,
  customerName: z.string().min(1, "お名前を入力してください"),
  customerEmail: z.email("メールアドレスの形式が正しくありません"),
  postalCode: z.string().min(1, "郵便番号を入力してください"),
  address: z.string().min(1, "住所を入力してください"),
  phoneNumber: z.string().min(1, "電話番号を入力してください"),
  deliveryDate: z.string().optional(),
  deliveryTimeSlot: z.enum(DELIVERY_TIME_SLOT_OPTIONS),
  requestNote: z
    .string()
    .max(1000, "1000文字以内で入力してください")
    .optional(),
  agreeCopyright: z.literal(true, "著作権に関する同意が必要です"),
  agreeRisk: z.literal(true, "造形リスクに関する同意が必要です"),
  generationCreditsUsed: z.number().int().min(0),
  wantsHardware: z.boolean(),
  holePosition: z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .nullable(),
  bottomHolePosition: z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .nullable(),
  bottomHoleDiameterMm: z
    .number()
    .min(MIN_BOTTOM_HOLE_DIAMETER_MM)
    .max(MAX_BOTTOM_HOLE_DIAMETER_MM),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export type OrderRecord = {
  referenceImageUrls: string[];
  modelUrl: string | null;
  finishedPreviewUrls: Partial<Record<MagicColor, string>>;
  subject: string;
  pose: Pose;
  sizeOption: SizeOption;
  colorQuantities: ColorQuantities;
  estimatedPriceYen: number;
  shippingYen: number;
  discountYen: number;
  wantsHardware: boolean;
  holePosition: HolePoint | null;
  bottomHolePosition: HolePoint | null;
  bottomHoleDiameterMm: number | null;
  customerName: string;
  customerEmail: string;
  postalCode: string;
  address: string;
  phoneNumber: string;
  deliveryDate: string | null;
  deliveryTimeSlot: DeliveryTimeSlot;
  requestNote: string;
  createdAt: unknown;
  shippingMethod: string | null;
  modelBoundingBoxMm: BoundingBoxMm | null;
  scaledModelUrl: string | null;
  scaledBoundingBoxMm: BoundingBoxMm | null;
  maxDimensionMm: number | null;
  status: OrderStatus;
  batchId: string | null;
  gridId: string | null;
  finishedModelUrl: string | null;
  wallThicknessMm: number | null;
  hasVentHole: boolean;
  ventHoleSource: "auto" | "customer" | null;
};
