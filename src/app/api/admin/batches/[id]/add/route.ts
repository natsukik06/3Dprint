import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { buildBatchEntry, itemQuantity, nextFreeGridIds } from "@/lib/batchEntries";
import { adminDb } from "@/lib/firebaseAdmin";
import type { PrintBatchOrderEntry, PrintBatchRecord } from "@/types/batch";

type CopiesRequest = { itemId: string; count: number };

// Adds to an existing, not-yet-completed batch AFTER it was created -- for when a print fails and
// some pieces have to be made again, or a late order should ride along with this batch instead of
// waiting for the next one. Two kinds of additions, combinable in one request:
//   itemIds -- still-pending order_items, batched exactly like the generate route would (one cell
//              per physical copy), now into THIS batch.
//   copies  -- extra copies of a design that's already in this batch (a failed piece): new cells
//              flagged `reprint`, sharing the design's existing hollowed/finished model, so
//              nothing needs hollowing again.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: batchId } = await params;

  let itemIds: string[] = [];
  let copies: CopiesRequest[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.itemIds) && body.itemIds.every((v: unknown) => typeof v === "string")) {
      itemIds = body.itemIds;
    }
    if (Array.isArray(body?.copies)) {
      copies = body.copies
        .filter(
          (c: unknown): c is CopiesRequest =>
            !!c &&
            typeof (c as CopiesRequest).itemId === "string" &&
            Number.isInteger((c as CopiesRequest).count) &&
            (c as CopiesRequest).count >= 1 &&
            (c as CopiesRequest).count <= 30
        )
        .map((c: CopiesRequest) => ({ itemId: c.itemId, count: c.count }));
    }
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (itemIds.length === 0 && copies.length === 0) {
    return NextResponse.json({ error: "追加する内容がありません" }, { status: 400 });
  }

  try {
    const batchRef = adminDb.collection("print_batches").doc(batchId);
    const batchSnap = await batchRef.get();
    if (!batchSnap.exists) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }
    const batch = batchSnap.data() as PrintBatchRecord;
    if (batch.completed) {
      return NextResponse.json(
        { error: "完了済みのバッチには追加できません。先に「未完了に戻す」を押してください" },
        { status: 400 }
      );
    }

    const entries: PrintBatchOrderEntry[] = [...batch.entries];
    const usedGridIds = entries.map((e) => e.gridId);
    const writeBatch = adminDb.batch();
    let added = 0;

    for (const itemId of itemIds) {
      const itemRef = adminDb.collection("order_items").doc(itemId);
      const itemSnap = await itemRef.get();
      const data = itemSnap.data();
      if (!itemSnap.exists || !data) {
        return NextResponse.json({ error: `アイテムが見つかりません: ${itemId}` }, { status: 404 });
      }
      if (data.status !== "pending" || !data.scaledModelUrl) {
        return NextResponse.json(
          { error: `未バッチではない（または未処理の）アイテムは追加できません: ${itemId}` },
          { status: 400 }
        );
      }
      const gridIds = nextFreeGridIds(usedGridIds, itemQuantity(data.colorQuantities));
      usedGridIds.push(...gridIds);
      for (const gridId of gridIds) entries.push(buildBatchEntry(itemId, data, gridId));
      added += gridIds.length;
      writeBatch.update(itemRef, {
        status: "batched",
        batchId,
        gridId: gridIds.join(","),
      });
    }

    for (const { itemId, count } of copies) {
      if (!entries.some((e) => e.itemId === itemId)) {
        return NextResponse.json(
          { error: `このバッチに入っていないアイテムは再印刷できません: ${itemId}` },
          { status: 400 }
        );
      }
      const itemRef = adminDb.collection("order_items").doc(itemId);
      const itemSnap = await itemRef.get();
      const data = itemSnap.data();
      if (!itemSnap.exists || !data) {
        return NextResponse.json({ error: `アイテムが見つかりません: ${itemId}` }, { status: 404 });
      }
      const gridIds = nextFreeGridIds(usedGridIds, count);
      usedGridIds.push(...gridIds);
      for (const gridId of gridIds) entries.push(buildBatchEntry(itemId, data, gridId, true));
      added += gridIds.length;
      const existingGridIds = typeof data.gridId === "string" && data.gridId ? [data.gridId] : [];
      writeBatch.update(itemRef, { gridId: [...existingGridIds, ...gridIds].join(",") });
    }

    writeBatch.update(batchRef, { entries, totalCount: entries.length });
    await writeBatch.commit();

    return NextResponse.json({ added, totalCount: entries.length });
  } catch (error) {
    console.error("batch add failed", error);
    const message = error instanceof Error ? error.message : "追加に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
