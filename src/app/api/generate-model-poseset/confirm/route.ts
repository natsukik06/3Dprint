import { NextResponse, type NextRequest } from "next/server";
import { addDiscountableCredit, consumeCredit, refundCredit } from "@/lib/credits";
import type { ImagePayload } from "@/lib/gemini";
import { createMultiviewTask, uploadImageToTripo } from "@/lib/tripo";
import { guardTripoCapacity } from "@/lib/tripoCapacity";
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
 * Per-pose model kickoff for the 5-pose-set product -- mirrors /api/generate-model/confirm, but
 * takes only ONE already-colored single-view pose image (from /api/generate-model-poseset) instead
 * of a 4-direction turnaround, and calls Tripo in single-image mode (front only). The customer's
 * frontend calls this once per pose they selected, in parallel -- each call spends its own credit
 * and returns its own taskId, polled via the existing (view-count-agnostic) /api/generate-model/
 * [taskId] route.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Paused (503) while the Tripo account is out of credits -- see guardTripoCapacity.
  const paused = await guardTripoCapacity();
  if (paused) return paused;

  const body = await request.json().catch(() => null);
  const image = body?.image;
  if (!isImagePayload(image)) {
    return NextResponse.json({ error: "ポーズ画像が正しく渡されていません" }, { status: 400 });
  }

  const hasCredit = await consumeCredit(user.uid);
  if (!hasCredit) {
    return NextResponse.json(
      { error: "クレジットが不足しています。購入してからお試しください。" },
      { status: 402 }
    );
  }

  try {
    const token = await uploadImageToTripo(
      Buffer.from(image.data, "base64"),
      "pose.png",
      image.mimeType
    );
    const taskId = await createMultiviewTask({ front: token });

    // Only once the (paid) Tripo task is actually successfully queued -- see the same comment in
    // generate-model/confirm/route.ts.
    await addDiscountableCredit(user.uid);

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error("generate-model-poseset/confirm failed", error);
    await refundCredit(user.uid);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
