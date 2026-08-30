// Minimal mirror of the subset of src/types/order.ts this package's job processors need.
// Kept intentionally small rather than importing the whole app's type module, since Cloud
// Functions only touches production-pipeline data, not the customer-facing order form.

export type SizeOption = "S" | "M" | "L";

export const SIZE_TARGET_MM: Record<SizeOption, number> = { S: 28, M: 40, L: 50 };

export type BoundingBoxMm = { x: number; y: number; z: number };

export type HolePoint = {
  x: number;
  y: number;
  z: number;
  nx?: number;
  ny?: number;
  nz?: number;
};

export const HARDWARE_HOLE_DIAMETER_MM = 3;
export const DEFAULT_DRAIN_HOLE_DIAMETER_MM = 2;

export type PrintBatchOrderEntry = {
  itemId: string;
  orderId: string;
  gridId: string;
  customerName: string;
  subject: string;
  sizeOption: SizeOption;
  colorSummary: string;
  maxDimensionMm: number | null;
};
