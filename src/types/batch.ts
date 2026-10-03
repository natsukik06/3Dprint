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
  // True for an extra copy added to an already-created batch after a print failed (see
  // /api/admin/batches/[id]/add) -- shown on the work sheet so it's obvious the cell is a redo.
  reprint?: boolean;
};

export type PrintBatchRecord = {
  entries: PrintBatchOrderEntry[];
  totalCount: number;
  completedCells: string[];
  createdAt: unknown;
  // Absent on batches created before this field existed -- treat missing/undefined the same as
  // false (still active) rather than requiring a migration.
  completed?: boolean;
  completedAt?: unknown;
};
