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

    // Each order_item is one DESIGN, hollowed/hole-cut once -- but a customer can order several
    // physical copies of that same design (colorQuantities summing to >1), and each copy needs
    // its own spot on the print plate. Fill grid cells by physical unit count, not by design
    // count, so a "10個" order actually reserves 10 cells instead of 1. Kept simple: a design
    // that wouldn't fully fit in the remaining capacity is left for the next batch rather than
    // split across two (its plate-layout would otherwise need to span two separate batches).
    const gridSequence = buildGridSequence();
    const entries: PrintBatchOrderEntry[] = [];
    let nextGridIndex = 0;
    for (const doc of candidates) {
      if (nextGridIndex >= MAX_CAPACITY) break;
      const data = doc.data();
      const quantity = Math.max(1, getTotalQuantity(data.colorQuantities as ColorQuantities));
      if (nextGridIndex + quantity > MAX_CAPACITY) continue;

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
