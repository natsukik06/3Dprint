import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { PrintBatchRecord } from "@/types/batch";

// Undoes a mistakenly-created batch: every order_item it touched goes back to "pending" (batchId/
// gridId cleared) so it reappears in the 未バッチの注文 list on /admin/batches and can be
// re-batched correctly, and the print_batches document itself is deleted. Doesn't touch
// scaledModelUrl/finishedModelUrl -- any hollowing/upload work already done on an item survives
// and just carries over into whichever batch picks it up next.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: batchId } = await params;

  try {
    const batchRef = adminDb.collection("print_batches").doc(batchId);
    const batchSnap = await batchRef.get();
    if (!batchSnap.exists) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }
    const batch = batchSnap.data() as PrintBatchRecord;
    if (batch.completed) {
      return NextResponse.json(
        { error: "完了済みのバッチは取り消せません" },
        { status: 400 }
      );
    }

    const itemIds = [...new Set(batch.entries.map((e) => e.itemId))];
    const writeBatch = adminDb.batch();
    for (const itemId of itemIds) {
      writeBatch.update(adminDb.collection("order_items").doc(itemId), {
        status: "pending",
        batchId: null,
        gridId: null,
      });
    }
    writeBatch.delete(batchRef);
    await writeBatch.commit();

    return NextResponse.json({ itemCount: itemIds.length });
  } catch (error) {
    console.error("batch undo failed", error);
    const message = error instanceof Error ? error.message : "取り消しに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
