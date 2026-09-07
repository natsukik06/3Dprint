import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { extractWorldTriangles } from "@/lib/modelScaling";
import { trianglesToStl } from "@/lib/stl";

// Converts an item's raw (pre-hollow) scaled model from GLB to STL, server-side -- GLB is what
// processOrder.ts produces, but the admin's own local pipeline (Blender hollow_and_hole.py) only
// reads/writes STL. Lets the admin download plain STLs to hollow/hole/support themselves, then
// hand the results back via upload-finished, skipping this app's own (slow) hollow Cloud Function.
export async function GET(
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
    const data = itemSnap.data();
    const sourceUrl = data?.scaledModelUrl ?? data?.modelUrl;
    if (!sourceUrl) {
      return NextResponse.json({ error: "3Dモデルが未生成です" }, { status: 400 });
    }

    const modelRes = await fetch(sourceUrl);
    if (!modelRes.ok) {
      return NextResponse.json({ error: "モデルのダウンロードに失敗しました" }, { status: 502 });
    }
    const buffer = Buffer.from(await modelRes.arrayBuffer());
    const triangles = extractWorldTriangles(buffer);
    const stl = trianglesToStl(triangles);

    return new NextResponse(new Uint8Array(stl), {
      headers: {
        "Content-Type": "model/stl",
        "Content-Disposition": `attachment; filename="${itemId}.stl"`,
      },
    });
  } catch (error) {
    console.error("raw-stl conversion failed", error);
    const message = error instanceof Error ? error.message : "変換に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
