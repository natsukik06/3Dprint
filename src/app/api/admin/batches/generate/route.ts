import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { buildGridSequence, MAX_CAPACITY } from "@/lib/batches";
import { adminDb } from "@/lib/firebaseAdmin";
import { getTotalQuantity, MAGIC_COLOR_LABELS } from "@/lib/pricing";
import { MAGIC_COLOR_OPTIONS, type ColorQuantities, type SizeOption } from "@/types/order";
import type { PrintBatchOrderEntry } from "@/types/batch";

function summarizeColors(colorQuantities: ColorQuantities | undefined): string {
  if (!colorQuantities) return "";
  return MAGIC_COLOR_OPTIONS.filter((c) => (colorQuantities[c] ?? 0) > 0)
    .map((c) => `${MAGIC_COLOR_LABELS[c]}×${colorQuantities[c]}`)
    .join(" / ");
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  try {
    const snap = await adminDb
      .collection("order_items")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(MAX_CAPACITY * 2)
      .get();

    const candidates = snap.docs.filter((d) => !!d.data().scaledModelUrl);

    // Group by orderId first -- a customer's whole set (every design in one order) always lands
    // in the same batch/plate together, never split across two, even if that means a batch runs
    // over the normal MAX_CAPACITY target (the physical plate packing in plateLayout.ts handles
    // any actual size overflow by spanning extra physical plates; this is just about keeping one
    // order's paper work-sheet cells and hollow/hole handling together in one pass).
    type CandidateGroup = { orderId: string; docs: typeof candidates };
    const groupsByOrderId = new Map<string, CandidateGroup>();
    const groupOrder: CandidateGroup[] = [];
    for (const doc of candidates) {
      const orderId = (doc.data().orderId as string) ?? doc.id;
      let group = groupsByOrderId.get(orderId);
      if (!group) {
        group = { orderId, docs: [] };
        groupsByOrderId.set(orderId, group);
        groupOrder.push(group);
      }
      group.docs.push(doc);
    }

    // Each order_item is one DESIGN, hollowed/hole-cut once -- but a customer can order several
    // physical copies of that same design (colorQuantities summing to >1), and each copy needs
    // its own spot on the print plate. Fill grid cells by physical unit count, not by design
    // count, so a "10個" order actually reserves 10 cells instead of 1.
    function groupQuantity(group: CandidateGroup): number {
      return group.docs.reduce(
        (sum, doc) =>
          sum + Math.max(1, getTotalQuantity(doc.data().colorQuantities as ColorQuantities)),
        0
      );
    }

    let plannedCells = 0;
    const includedGroups: CandidateGroup[] = [];
    for (const group of groupOrder) {
      const quantity = groupQuantity(group);
      // Always take the very first group even if it alone exceeds MAX_CAPACITY (a single
      // oversized order should never be stuck waiting forever) -- every group after that only
      // joins if it fully fits in what's left, same "don't split, skip and keep looking for a
      // smaller one that fits" behavior as before, just applied per-order instead of per-design.
      if (includedGroups.length > 0 && plannedCells + quantity > MAX_CAPACITY) continue;
      includedGroups.push(group);
      plannedCells += quantity;
    }

    const gridSequence = buildGridSequence(Math.max(MAX_CAPACITY, plannedCells));
    const entries: PrintBatchOrderEntry[] = [];
    let nextGridIndex = 0;
    for (const group of includedGroups) {
      for (const doc of group.docs) {
        const data = doc.data();
        const quantity = Math.max(1, getTotalQuantity(data.colorQuantities as ColorQuantities));
        for (let i = 0; i < quantity; i++) {
          entries.push({
            itemId: doc.id,
            orderId: data.orderId ?? "",
            gridId: gridSequence[nextGridIndex],
            customerName: data.customerName ?? "",
            subject: data.subject ?? "",
            sizeOption: (data.sizeOption ?? "S") as SizeOption,
            colorSummary: summarizeColors(data.colorQuantities),
            maxDimensionMm: data.maxDimensionMm ?? null,
            initial: data.initial ?? "",
          });
          nextGridIndex++;
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "バッチ生成対象の未処理アイテムがありません" },
        { status: 400 }
      );
    }

    const batchRef = adminDb.collection("print_batches").doc();
    const writeBatch = adminDb.batch();

    writeBatch.set(batchRef, {
      entries,
      totalCount: entries.length,
      completedCells: [],
      createdAt: new Date(),
    });

    const gridIdsByItem = new Map<string, string[]>();
    for (const entry of entries) {
      const list = gridIdsByItem.get(entry.itemId) ?? [];
      list.push(entry.gridId);
      gridIdsByItem.set(entry.itemId, list);
    }
    for (const [itemId, gridIds] of gridIdsByItem) {
      writeBatch.update(adminDb.collection("order_items").doc(itemId), {
        status: "batched",
        batchId: batchRef.id,
        // A design occupying multiple cells (quantity > 1) stores all of them here, comma
        // joined -- this field is just an admin display convenience; print_batches.entries is
        // the real source of truth for the itemId <-> gridId mapping.
        gridId: gridIds.join(","),
      });
    }

    await writeBatch.commit();

    return NextResponse.json({ batchId: batchRef.id, totalCount: entries.length });
  } catch (error) {
    console.error("batch generation failed", error);
    return NextResponse.json({ error: "バッチ生成に失敗しました" }, { status: 500 });
  }
}
