import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import type { PrintBatchRecord } from "@/types/batch";

// Reverses buildPublicUrl (processOrder.ts, upload-finished/route.ts): pulls the bucket object
// path back out of a `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media`
// download URL. Returns null for anything else (already-deleted/foreign URL) so callers can skip
// it instead of throwing.
function storagePathFromUrl(url: string): string | null {
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

// Frees Storage space once a completed batch's models have been archived elsewhere (USB) --
// deletes only the PRODUCTION copies (scaledModelUrl from processOrder.ts, finishedModelUrl from
// the hollow/hole step), never the original `modelUrl`, which is the same file the customer's own
// mypage still displays for their order history. order_items documents (and the orders collection
// entirely) are left untouched -- only the two URL fields are cleared after their files are gone.
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
    const batchSnap = await adminDb.collection("print_batches").doc(batchId).get();
    if (!batchSnap.exists) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }
    const batch = batchSnap.data() as PrintBatchRecord;
    const itemIds = [...new Set(batch.entries.map((e) => e.itemId))];

    const bucket = adminStorage.bucket();
    let deletedFiles = 0;
    let clearedItems = 0;

    await Promise.all(
      itemIds.map(async (itemId) => {
        const itemRef = adminDb.collection("order_items").doc(itemId);
        const itemSnap = await itemRef.get();
        if (!itemSnap.exists) return;
        const data = itemSnap.data();
        const urls = [data?.scaledModelUrl, data?.finishedModelUrl].filter(
          (u): u is string => typeof u === "string" && u.length > 0
        );
        if (urls.length === 0) return;

        await Promise.all(
          urls.map(async (url) => {
            const path = storagePathFromUrl(url);
            if (!path) return;
            try {
              await bucket.file(path).delete();
              deletedFiles++;
            } catch (error) {
              // Already deleted, or never existed -- fine, just skip it and keep going with the
              // rest of the batch rather than aborting the whole cleanup over one missing file.
              console.warn(`delete-models: failed to delete ${path}`, error);
            }
          })
        );

        await itemRef.update({ scaledModelUrl: null, finishedModelUrl: null });
        clearedItems++;
      })
    );

    return NextResponse.json({ deletedFiles, clearedItems });
  } catch (error) {
    console.error("delete-models failed", error);
    const message = error instanceof Error ? error.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
