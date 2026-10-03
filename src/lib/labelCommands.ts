import { GLOW_COLOR_OPTIONS, HARDWARE_COLOR_LABELS, type OrderItemDraft } from "@/types/order";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";

// One line per item, matching the same summary shown on the admin packing-slip/spec-list pages --
// kept as its own function so all three stay in sync instead of drifting apart.
export function summarizeOrderItemForLabel(item: OrderItemDraft): string {
  const colors = Object.entries(item.colorQuantities)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as keyof typeof MAGIC_COLOR_LABELS]}×${qty}`)
    .join("・");
  const hardware = item.wantsHardware
    ? `／金具:${HARDWARE_COLOR_LABELS[item.hardwareColor]}`
    : "";
  const engraving = item.wantsEngraving
    ? `／名前刻印:「${item.engravingText}」(${item.engravingFont})`
    : "";
  return `${item.subject}（${item.sizeOption}） ${colors}${hardware}${engraving}`;
}

// True when any item in the order uses a glow-in-the-dark color.
export function orderHasGlow(items: OrderItemDraft[]): boolean {
  return items.some((item) =>
    GLOW_COLOR_OPTIONS.some((color) => (item.colorQuantities[color] ?? 0) > 0)
  );
}

// Windows batch has no clean universal escape for embedded double-quotes inside a quoted arg, so
// just strip them (and any stray newlines) rather than risk a broken/dangerous command string --
// real customer data essentially never contains a literal quote character anyway.
function sanitizeForBatchArg(value: string): string {
  return value.replace(/["\r\n]/g, "").trim();
}

function quoteArg(value: string): string {
  return `"${sanitizeForBatchArg(value)}"`;
}

export type LabelPrintCommands = {
  contents: string;
};

// Same set of designs, printed together on one plate -- the batch pages let the admin handle
// modeling/hollowing for a whole batch at once, but each physical package's contents label is
// still keyed by ORDER, not by batch. One command per distinct order in the batch, one per line --
// pasting a multi-line block runs each line as its own command in sequence, in both cmd.exe and
// PowerShell, so this doesn't need `&&` (unsupported in Windows PowerShell 5.1) to chain them.
export function buildBatchLabelPrintCommand(
  orders: { orderNumber?: string; items: OrderItemDraft[] }[]
): string {
  return orders.map((order) => buildLabelPrintCommands(order).contents).join("\n");
}

// Builds the exact, ready-to-paste print_contents_label.bat command line for one order -- so
// printing it is "copy, paste into a terminal, Enter" instead of retyping/reformatting the item
// list by hand each time. No recipient/sender command here -- the destination and return address
// already appear on the carrier's own official shipping label/waybill (see print_labels.bat and
// AdminOrderDetail's own note), so a separate address sticker would just be redundant.
export function buildLabelPrintCommands(order: {
  orderNumber?: string;
  items: OrderItemDraft[];
}): LabelPrintCommands {
  const orderNumberArg = quoteArg(order.orderNumber ?? "");
  const itemArgs = order.items.map((item) => quoteArg(summarizeOrderItemForLabel(item))).join(" ");

  return {
    // Leading ".\" -- PowerShell (the default terminal now) refuses to run a script from the current
    // folder without it and misreads "label-pipeline\..." as a module name; cmd accepts it too.
    contents: `.\\label-pipeline\\scripts\\print_contents_label.bat ${orderNumberArg} ${itemArgs}`,
  };
}
