import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { SHOWCASE_COLLECTION, storagePathFromUrl, storagePublicUrl } from "@/lib/showcase";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_EDGE_PX = 1600;

// 実物写真のアップロード。形式・サイズを検証し、長辺1600pxに縮小したwebpで showcase/<id>/ に保存する。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  const { id } = await params;
  try {
    const ref = adminDb.collection(SHOWCASE_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "画像は10MB以下にしてください" }, { status: 413 });
    }

    const input = Buffer.from(await file.arrayBuffer());
    let format: string | undefined;
    try {
      format = (await sharp(input).metadata()).format;
    } catch {
      format = undefined;
    }
    if (!format || !ALLOWED_FORMATS.has(format)) {
      return NextResponse.json({ error: "JPEG/PNG/WEBP形式の画像を選んでください" }, { status: 415 });
    }

    const output = await sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const bucket = adminStorage.bucket();
    const path = `showcase/${id}/photo-${Date.now()}.webp`;
    await bucket.file(path).save(output, { contentType: "image/webp", resumable: false });

    // 古い実物写真を消す
    const oldUrl = snap.data()?.photoUrl;
    const oldPath = typeof oldUrl === "string" ? storagePathFromUrl(oldUrl, bucket.name) : null;
    if (oldPath && oldPath.startsWith(`showcase/${id}/photo-`) && oldPath !== path) {
      await bucket.file(oldPath).delete({ ignoreNotFound: true });
    }

    const photoUrl = storagePublicUrl(bucket.name, path);
    await ref.update({ photoUrl });
    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error("showcase photo failed", error);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}

// 実物写真を外す
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  const { id } = await params;
  try {
    const ref = adminDb.collection(SHOWCASE_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    const bucket = adminStorage.bucket();
    const oldUrl = snap.data()?.photoUrl;
    const oldPath = typeof oldUrl === "string" ? storagePathFromUrl(oldUrl, bucket.name) : null;
    if (oldPath && oldPath.startsWith(`showcase/${id}/photo-`)) {
      await bucket.file(oldPath).delete({ ignoreNotFound: true });
    }
    await ref.update({ photoUrl: null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("showcase photo delete failed", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
