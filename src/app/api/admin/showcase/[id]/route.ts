import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { SHOWCASE_COLLECTION } from "@/lib/showcase";
import { SHOWCASE_CAPTION_MAX, SHOWCASE_TITLE_MAX } from "@/types/showcase";

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/examples");
}

// 下書きの編集(タイトル・一言・表示順・ホーム表示)。公開側には「反映」を押すまで出ない。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  const { id } = await params;
  try {
    const ref = adminDb.collection(SHOWCASE_COLLECTION).doc(id);
    if (!(await ref.get()).exists) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title.trim().slice(0, SHOWCASE_TITLE_MAX);
    if (typeof body.caption === "string") patch.caption = body.caption.trim().slice(0, SHOWCASE_CAPTION_MAX);
    if (typeof body.showOnHome === "boolean") patch.showOnHome = body.showOnHome;
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      patch.order = Math.max(0, Math.min(9999, Math.round(body.order)));
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "変更する項目がありません" }, { status: 400 });
    }
    await ref.update(patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("showcase patch failed", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// 削除: 文書と showcase/<id>/ 配下のコピー(モデル・お客様写真・実物写真)を消す。元の注文データは触らない。
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "IDが正しくありません" }, { status: 400 });
  }
  try {
    await adminStorage.bucket().deleteFiles({ prefix: `showcase/${id}/` });
    await adminDb.collection(SHOWCASE_COLLECTION).doc(id).delete();
    revalidatePublicPages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("showcase delete failed", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
