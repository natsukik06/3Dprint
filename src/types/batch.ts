import type { SizeOption } from "@/types/order";

export type PrintBatchOrderEntry = {
  orderId: string;
  gridId: string;
  customerName: string;
  subject: string;
  sizeOption: SizeOption;
  colorSummary: string;
  maxDimensionMm: number | null;
};

export type PrintBatchRecord = {
  entries: PrintBatchOrderEntry[];
  totalCount: number;
  completedCells: string[];
  createdAt: unknown;
};
