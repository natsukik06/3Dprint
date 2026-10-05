import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { SHOWCASE_COLLECTION } from "@/lib/showcase";

// 「反映」: published=true にして公開側(ホーム・/examples)を更新する。published:false で非公開に戻す。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  const { id } = await params;
  try {
    const body = (await request.json().catch(() => ({}))) as { published?: unknown };
    const publish = body.published !== false;
    const ref = adminDb.collection(SHOWCASE_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    if (publish) {
      const data = snap.data() ?? {};
      if (!String(data.title ?? "").trim()) {
        return NextResponse.json({ error: "タイトルを入力してから反映してください" }, { status: 400 });
      }
      await ref.update({ published: true, publishedAt: FieldValue.serverTimestamp() });
    } else {
      await ref.update({ published: false, publishedAt: null });
    }

    revalidatePath("/");
    revalidatePath("/examples");
    return NextResponse.json({ ok: true, published: publish });
  } catch (error) {
    console.error("showcase publish failed", error);
    return NextResponse.json({ error: "反映に失敗しました" }, { status: 500 });
  }
}
