import { NextResponse, type NextRequest } from "next/server";
import { VIEWS, type ImagePayload } from "@/lib/gemini";
import { createMultiviewTask, uploadImageToTripo } from "@/lib/tripo";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

function isImagePayload(value: unknown): value is ImagePayload {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ImagePayload).data === "string" &&
    typeof (value as ImagePayload).mimeType === "string"
  );
}

/**
 * Second half of model generation: the customer has already reviewed the four turnaround views
 * from /api/generate-model and approved the shape, so this just sends those same images on to
 * Tripo's (paid) reconstruction. No credit charge here -- that already happened generating the
 * views themselves.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const views = body?.views;
  if (!views || !VIEWS.every((view) => isImagePayload(views[view]))) {
    return NextResponse.json(
      { error: "4方向の画像が正しく渡されていません" },
      { status: 400 }
    );
  }

  try {
    const viewTokenEntries = await Promise.all(
      VIEWS.map(async (view) => {
        const image = views[view] as ImagePayload;
        const token = await uploadImageToTripo(
          Buffer.from(image.data, "base64"),
          `${view}.png`,
          image.mimeType
        );
        return [view, token] as const;
      })
    );
    const viewTokens = Object.fromEntries(viewTokenEntries) as Record<
      (typeof VIEWS)[number],
      string
    >;

    const taskId = await createMultiviewTask({
      front: viewTokens.front,
      left: viewTokens.left,
      back: viewTokens.back,
      right: viewTokens.right,
    });

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error("generate-model/confirm failed", error);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
