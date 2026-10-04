import { getTotalQuantity } from "@/lib/pricing";
import {
  HARDWARE_COLOR_OPTIONS,
  MAGIC_COLOR_OPTIONS,
  type ColorQuantities,
  type HardwareAssignments,
  type HardwareColor,
  type MagicColor,
} from "@/types/order";

const emptyColors = (): ColorQuantities =>
  Object.fromEntries(MAGIC_COLOR_OPTIONS.map((c) => [c, 0])) as ColorQuantities;

/** Pieces of `color` that get each strap color, clamped so the total never exceeds `quantity`. */
export function assignmentFor(
  assignments: HardwareAssignments | undefined,
  color: MagicColor,
  quantity: number
): Partial<Record<HardwareColor, number>> {
  const raw = assignments?.[color];
  if (!raw) return { silver: quantity }; // default: every piece gets the standard strap
  const out: Partial<Record<HardwareColor, number>> = {};
  let left = quantity;
  for (const strap of HARDWARE_COLOR_OPTIONS) {
    const n = Math.max(0, Math.min(left, Math.floor(raw[strap] ?? 0)));
    if (n > 0) out[strap] = n;
    left -= n;
  }
  return out;
}

/** Keeps the assignments in step with the chosen resin colors/quantities (drops colors no longer
 * chosen, fills new ones with the default, trims anything above the piece count). */
export function normalizeAssignments(
  assignments: HardwareAssignments | undefined,
  colorQuantities: ColorQuantities
): HardwareAssignments {
  const out: HardwareAssignments = {};
  for (const color of MAGIC_COLOR_OPTIONS) {
    const qty = colorQuantities[color] ?? 0;
    if (qty > 0) out[color] = assignmentFor(assignments, color, qty);
  }
  return out;
}

type SplittableItem = {
  colorQuantities: ColorQuantities;
  wantsHardware: boolean;
  hardwareColor: HardwareColor;
  chainPositionNote?: string;
};

/**
 * One draft -> the cart items it becomes. Production prints, drills and ships per ITEM (every piece
 * in an item shares one model and one hole), so pieces that get different straps -- or no strap --
 * have to be separate items. Pieces are grouped by strap color, each group keeping its resin colors.
 * Total pieces and prices are unchanged by the split.
 */
export function splitByHardware<T extends SplittableItem>(
  base: T,
  assignments: HardwareAssignments | undefined,
  defaultStrap: HardwareColor
): T[] {
  if (!base.wantsHardware) {
    return [{ ...base, hardwareColor: defaultStrap, chainPositionNote: "" }];
  }

  const groups = new Map<HardwareColor | "none", ColorQuantities>();
  const add = (key: HardwareColor | "none", color: MagicColor, n: number) => {
    if (n <= 0) return;
    const g = groups.get(key) ?? emptyColors();
    g[color] += n;
    groups.set(key, g);
  };

  for (const color of MAGIC_COLOR_OPTIONS) {
    const qty = base.colorQuantities[color] ?? 0;
    if (qty <= 0) continue;
    const a = assignmentFor(assignments, color, qty);
    let strapped = 0;
    for (const strap of HARDWARE_COLOR_OPTIONS) {
      add(strap, color, a[strap] ?? 0);
      strapped += a[strap] ?? 0;
    }
    add("none", color, qty - strapped);
  }

  const order: (HardwareColor | "none")[] = [...HARDWARE_COLOR_OPTIONS, "none"];
  const items: T[] = [];
  for (const key of order) {
    const colorQuantities = groups.get(key);
    if (!colorQuantities || getTotalQuantity(colorQuantities) === 0) continue;
    items.push({
      ...base,
      colorQuantities,
      wantsHardware: key !== "none",
      hardwareColor: key === "none" ? defaultStrap : key,
      chainPositionNote: key === "none" ? "" : base.chainPositionNote,
    });
  }
  return items.length > 0 ? items : [{ ...base, wantsHardware: false, hardwareColor: defaultStrap, chainPositionNote: "" }];
}
