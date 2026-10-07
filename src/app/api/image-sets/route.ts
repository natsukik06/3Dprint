import { NextResponse, type NextRequest } from "next/server";
import { listImageSets, type ImageSetKind } from "@/lib/imageSets";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

// The signed-in customer's own saved image sets (newest first), with tiny thumbnails.
export async function GET(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const kindRaw = request.nextUrl.searchParams.get("kind");
  const kind =
    kindRaw === "single" || kindRaw === "duo" || kindRaw === "poseset"
      ? (kindRaw as ImageSetKind)
      : undefined;
  try {
    return NextResponse.json({ sets: await listImageSets(user.uid, kind) });
  } catch (error) {
    console.error("list image sets failed", error);
    return NextResponse.json({ error: "保存した画像を読み込めませんでした" }, { status: 500 });
  }
}
