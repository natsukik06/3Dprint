import type { SizeOption } from "@/types/order";

export type PrintBatchOrderEntry = {
  itemId: string;
  orderId: string;
  gridId: string;
  customerName: string;
  subject: string;
  sizeOption: SizeOption;
  colorSummary: string;
  maxDimensionMm: number | null;
  // Engraved into the piece itself during hollowing -- shown on the work sheet so the paper and
  // the physical object can always be cross-checked against each other, not just trusted blind.
  initial: string;
};

export type PrintBatchRecord = {
  entries: PrintBatchOrderEntry[];
  totalCount: number;
  completedCells: string[];
  createdAt: unknown;
};
