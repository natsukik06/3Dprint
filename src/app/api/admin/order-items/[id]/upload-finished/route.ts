import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

// Lets the admin hollow/hole/support a model themselves (their own Blender/PrusaSlicer setup --
// see print-pipeline/) and hand the result straight to this app, instead of running the built-in
// (slow) hollow/hole Cloud Function. Everything downstream of finishedModelUrl -- plate packing,
// the batch work sheet, "プレート配置ファイルを生成" -- doesn't care which path produced it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: itemId } = await params;

  try {
    const itemSnap = await adminDb.collection("order_items").doc(itemId).get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "STLファイルが必要です" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".stl")) {
      return NextResponse.json({ error: "STLファイルのみアップロードできます" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = adminStorage.bucket();
    const path = `models/${itemId}-finished.stl`;
    await bucket.file(path).save(buffer, { contentType: "model/stl" });
    const finishedModelUrl = buildPublicUrl(bucket.name, path);

    await itemSnap.ref.update({
      finishedModelUrl,
      wallThicknessMm: null,
      sphereSegments: null,
      hasVentHole: true,
      ventHoleSource: "manual",
    });

    return NextResponse.json({ finishedModelUrl });
  } catch (error) {
    console.error("upload-finished failed", error);
    const message = error instanceof Error ? error.message : "アップロードに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
