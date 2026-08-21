import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { buildGridSequence, MAX_CAPACITY } from "@/lib/batches";
import { adminDb } from "@/lib/firebaseAdmin";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";
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
    const selected = candidates.slice(0, MAX_CAPACITY);

    if (selected.length === 0) {
      return NextResponse.json(
        { error: "バッチ生成対象の未処理アイテムがありません" },
        { status: 400 }
      );
    }

    const gridSequence = buildGridSequence();
    const entries: PrintBatchOrderEntry[] = selected.map((doc, index) => {
      const data = doc.data();
      return {
        itemId: doc.id,
        orderId: data.orderId ?? "",
        gridId: gridSequence[index],
        customerName: data.customerName ?? "",
        subject: data.subject ?? "",
        sizeOption: (data.sizeOption ?? "S") as SizeOption,
        colorSummary: summarizeColors(data.colorQuantities),
        maxDimensionMm: data.maxDimensionMm ?? null,
      };
    });

    const batchRef = adminDb.collection("print_batches").doc();
    const writeBatch = adminDb.batch();

    writeBatch.set(batchRef, {
      entries,
      totalCount: entries.length,
      completedCells: [],
      createdAt: new Date(),
    });

    for (const entry of entries) {
      writeBatch.update(adminDb.collection("order_items").doc(entry.itemId), {
        status: "batched",
        batchId: batchRef.id,
        gridId: entry.gridId,
      });
    }

    await writeBatch.commit();

    return NextResponse.json({ batchId: batchRef.id, totalCount: entries.length });
  } catch (error) {
    console.error("batch generation failed", error);
    return NextResponse.json({ error: "バッチ生成に失敗しました" }, { status: 500 });
  }
}
