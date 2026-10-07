import { NextResponse, type NextRequest } from "next/server";
import { deleteImageSet, getImageSet } from "@/lib/imageSets";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

// One saved set with all of its images (only ever the signed-in customer's own -- the lookup is scoped to
// their uid, so another customer's set id simply isn't found).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { id } = await params;
  try {
    const set = await getImageSet(user.uid, id);
    if (!set) return NextResponse.json({ error: "画像セットが見つかりません" }, { status: 404 });
    return NextResponse.json(set);
  } catch (error) {
    console.error("get image set failed", error);
    return NextResponse.json({ error: "画像を読み込めませんでした" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteImageSet(user.uid, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete image set failed", error);
    return NextResponse.json({ error: "削除できませんでした" }, { status: 500 });
  }
}
