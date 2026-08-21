import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { boundsOfTriangles, extractWorldTriangles } from "@/lib/modelScaling";
import { buildPlateStl, packPlates, type StlPlacement } from "@/lib/plateLayout";
import type { PrintBatchOrderEntry } from "@/types/batch";

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

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
    const entries = (batchSnap.data()?.entries ?? []) as PrintBatchOrderEntry[];
    if (entries.length === 0) {
      return NextResponse.json({ error: "バッチに注文がありません" }, { status: 400 });
    }

    // Fetch each item's scaled model, resolved to world-space triangles + bounds.
    const items = await Promise.all(
      entries.map(async (entry) => {
        const itemSnap = await adminDb.collection("order_items").doc(entry.itemId).get();
        const scaledModelUrl = itemSnap.data()?.scaledModelUrl as string | undefined;
        if (!scaledModelUrl) {
          throw new Error(
            `アイテム ${entry.itemId}（${entry.gridId}）がスケーリング未処理です`
          );
        }
        const modelRes = await fetch(scaledModelUrl);
        if (!modelRes.ok) {
          throw new Error(`モデルのダウンロードに失敗しました: ${entry.orderId}`);
        }
        const buffer = Buffer.from(await modelRes.arrayBuffer());
        const triangles = extractWorldTriangles(buffer);
        const { min, max } = boundsOfTriangles(triangles);
        return {
          id: entry.gridId,
          triangles,
          worldMin: min,
          footprintX: max[0] - min[0],
          footprintZ: max[2] - min[2],
        };
      })
    );

    const plates = packPlates(
      items.map(({ id, footprintX, footprintZ }) => ({ id, footprintX, footprintZ }))
    );
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const bucket = adminStorage.bucket();

    const results = await Promise.all(
      plates.map(async (placedItems, plateIndex) => {
        const placements: StlPlacement[] = placedItems.map((placed) => {
          const item = itemsById.get(placed.id);
          if (!item) throw new Error(`配置アイテムが見つかりません: ${placed.id}`);
          return {
            triangles: item.triangles,
            worldMin: item.worldMin,
            targetX: placed.x,
            targetZ: placed.z,
          };
        });

        const stl = buildPlateStl(placements);
        const path = `batches/${batchId}/plate-${plateIndex + 1}.stl`;
        await bucket.file(path).save(stl, { contentType: "model/stl" });

        return {
          index: plateIndex + 1,
          itemCount: placedItems.length,
          gridIds: placedItems.map((p) => p.id),
          url: buildPublicUrl(bucket.name, path),
        };
      })
    );

    return NextResponse.json({ plates: results });
  } catch (error) {
    console.error("plate layout generation failed", error);
    const message = error instanceof Error ? error.message : "プレート配置の生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
