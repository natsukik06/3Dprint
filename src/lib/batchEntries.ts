import { buildGridSequence, MAX_CAPACITY } from "@/lib/batches";
import { getTotalQuantity, MAGIC_COLOR_LABELS } from "@/lib/pricing";
import type { PrintBatchOrderEntry } from "@/types/batch";
import { MAGIC_COLOR_OPTIONS, type ColorQuantities, type SizeOption } from "@/types/order";

export function summarizeColors(colorQuantities: ColorQuantities | undefined): string {
  if (!colorQuantities) return "";
  return MAGIC_COLOR_OPTIONS.filter((c) => (colorQuantities[c] ?? 0) > 0)
    .map((c) => `${MAGIC_COLOR_LABELS[c]}×${colorQuantities[c]}`)
    .join(" / ");
}

// How many physical pieces (= grid cells) one order_item needs: one design can be ordered in
// several copies, and each copy needs its own spot on the plate.
export function itemQuantity(colorQuantities: ColorQuantities | undefined): number {
  if (!colorQuantities) return 1;
  return Math.max(1, getTotalQuantity(colorQuantities));
}

// Server-side: one print_batches entry for one physical piece of an order_item. `data` is the
// order_item document's data.
export function buildBatchEntry(
  itemId: string,
  data: FirebaseFirestore.DocumentData,
  gridId: string,
  reprint = false
): PrintBatchOrderEntry {
  return {
    itemId,
    orderId: data.orderId ?? "",
    gridId,
    customerName: data.customerName ?? "",
    subject: data.subject ?? "",
    sizeOption: (data.sizeOption ?? "S") as SizeOption,
    colorSummary: summarizeColors(data.colorQuantities),
    maxDimensionMm: data.maxDimensionMm ?? null,
    initial: data.initial ?? "",
    ...(reprint ? { reprint: true } : {}),
  };
}

// The next `count` grid cells (row-major, A1,B1,...) not already used by this batch.
export function nextFreeGridIds(usedGridIds: string[], count: number): string[] {
  const used = new Set(usedGridIds);
  const sequence = buildGridSequence(Math.max(MAX_CAPACITY, used.size + count + MAX_CAPACITY));
  return sequence.filter((id) => !used.has(id)).slice(0, count);
}
