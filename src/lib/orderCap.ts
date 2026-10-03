import { adminDb } from "@/lib/firebaseAdmin";
import { getTotalQuantity } from "@/lib/pricing";
import {
  AVAILABLE_SIZE_OPTIONS,
  LARGE_SIZE_OPTIONS,
  type ColorQuantities,
  type SizeOption,
} from "@/types/order";

// Solo-fabricated, so weekly capacity is capped per product line rather than promising a lead
// time that can't be honored once orders pile up. Split into two pools (not one shared cap)
// because M (中空/hollowed) takes far longer per piece than the solid (中実) sizes -- see
// FIGURE_PRICE_YEN's comment in pricing.ts. Counts PIECES (physical figures), not orders, since
// that's what actually takes production time. Resets every Monday 00:00 JST.
export const WEEKLY_HOLLOW_PIECE_CAP = 150;
export const WEEKLY_SOLID_PIECE_CAP = 300;
// 50mm+ pieces are made in small nightly batches, so they get their own tiny pool (and are NOT
// counted against the 30-40mm solid pool above). Only matters once those sizes are switched on
// via AVAILABLE_SIZE_OPTIONS in types/order.ts.
export const WEEKLY_LARGE_PIECE_CAP = 10;

function startOfWeekJst(now: Date): Date {
  // Convert to JST calendar fields, then find that week's Monday at 00:00 JST, expressed as a
  // real UTC Date (JST = UTC+9, no DST) so Firestore Timestamp comparisons are unambiguous.
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const jstDay = jstNow.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (jstDay + 6) % 7;
  const jstMidnight = Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() - daysSinceMonday
  );
  return new Date(jstMidnight - 9 * 60 * 60 * 1000);
}

type WeeklyUsage = { hollowUsed: number; solidUsed: number; largeUsed: number };

type ProductLine = "hollow" | "large" | "solid";
function productLineOf(size: SizeOption): ProductLine {
  if (size === "M") return "hollow";
  if ((LARGE_SIZE_OPTIONS as readonly SizeOption[]).includes(size)) return "large";
  return "solid";
}

async function getWeeklyUsage(): Promise<WeeklyUsage> {
  const startOfWeek = startOfWeekJst(new Date());
  // Explicit orderBy("createdAt", "desc") so this reuses the existing paymentStatus+createdAt
  // (DESC) composite index already deployed for the admin order list, instead of requiring a
  // second index for the ASC direction Firestore would otherwise infer from a bare ">=" filter.
  const snap = await adminDb
    .collection("orders")
    .where("paymentStatus", "==", "paid")
    .where("createdAt", ">=", startOfWeek)
    .orderBy("createdAt", "desc")
    .get();

  let hollowUsed = 0;
  let solidUsed = 0;
  let largeUsed = 0;
  for (const doc of snap.docs) {
    const items = (doc.data().items ?? []) as {
      sizeOption: SizeOption;
      colorQuantities: ColorQuantities;
    }[];
    for (const item of items) {
      const qty = getTotalQuantity(item.colorQuantities);
      const line = productLineOf(item.sizeOption);
      if (line === "hollow") hollowUsed += qty;
      else if (line === "large") largeUsed += qty;
      else solidUsed += qty;
    }
  }
  return { hollowUsed, solidUsed, largeUsed };
}

/** Page-load gate: is there room for at least one more piece in EITHER product line right now? */
export async function isOrderingOpen(): Promise<boolean> {
  const { hollowUsed, solidUsed, largeUsed } = await getWeeklyUsage();
  // Only the product lines that are actually on sale (AVAILABLE_SIZE_OPTIONS) can keep the shop
  // "open" -- a line that can't be ordered (e.g. hollow M, large sizes) must not count as room.
  const sellingLines = new Set<ProductLine>(
    (AVAILABLE_SIZE_OPTIONS as readonly SizeOption[]).map(productLineOf)
  );
  return (
    (sellingLines.has("hollow") && hollowUsed < WEEKLY_HOLLOW_PIECE_CAP) ||
    (sellingLines.has("solid") && solidUsed < WEEKLY_SOLID_PIECE_CAP) ||
    (sellingLines.has("large") && largeUsed < WEEKLY_LARGE_PIECE_CAP)
  );
}

export type CapacityCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checkout-time enforcement: given the actual items about to be paid for, would completing this
 * order push either product line over its weekly cap? Unlike isOrderingOpen() above, this needs
 * the real cart contents, since a mixed cart could be fine for one line and over the limit for
 * the other.
 */
export async function checkWeeklyCapacity(
  items: { sizeOption: SizeOption; colorQuantities: ColorQuantities }[]
): Promise<CapacityCheck> {
  const { hollowUsed, solidUsed, largeUsed } = await getWeeklyUsage();

  let hollowWanted = 0;
  let solidWanted = 0;
  let largeWanted = 0;
  for (const item of items) {
    const qty = getTotalQuantity(item.colorQuantities);
    const line = productLineOf(item.sizeOption);
    if (line === "hollow") hollowWanted += qty;
    else if (line === "large") largeWanted += qty;
    else solidWanted += qty;
  }

  if (hollowWanted > 0 && hollowUsed + hollowWanted > WEEKLY_HOLLOW_PIECE_CAP) {
    return {
      ok: false,
      reason:
        "毛入れ用Mサイズ（中空）は今週の受付上限に達しました。来週の受付開始までお待ちいただくか、他のサイズでご注文ください。",
    };
  }
  if (solidWanted > 0 && solidUsed + solidWanted > WEEKLY_SOLID_PIECE_CAP) {
    return {
      ok: false,
      reason: "30〜40mmサイズは今週の受付上限に達しました。来週の受付開始までお待ちください。",
    };
  }
  if (largeWanted > 0 && largeUsed + largeWanted > WEEKLY_LARGE_PIECE_CAP) {
    return {
      ok: false,
      reason: "50mm以上の大きいサイズは数量限定のため、今週の受付上限に達しました。来週の受付開始までお待ちください。",
    };
  }
  return { ok: true };
}
