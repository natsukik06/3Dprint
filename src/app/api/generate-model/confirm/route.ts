import { NextResponse, type NextRequest } from "next/server";
import { addDiscountableCredit, consumeCredit, refundCredit } from "@/lib/credits";
import { VIEWS, type ImagePayload } from "@/lib/gemini";
import { recordGenerationHold } from "@/lib/generationHolds";
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
 * Second half of model generation: the customer has already reviewed the four (free) turnaround
 * views from /api/generate-model and approved the shape, so this sends those same images on to
 * Tripo's (paid) reconstruction. The credit is charged HERE, not when generating the views --
 * see checkAndConsumeFreeGeneration in src/lib/credits.ts for why.
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
  const views = body?.views;
  if (!views || !VIEWS.every((view) => isImagePayload(views[view]))) {
    return NextResponse.json(
      { error: "4方向の画像が正しく渡されていません" },
      { status: 400 }
    );
  }

  const hasCredit = await consumeCredit(user.uid);
  if (!hasCredit) {
    return NextResponse.json(
      { error: "クレジットが不足しています。購入してからお試しください。" },
      { status: 402 }
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

    // Only once the (paid) Tripo task is actually successfully queued -- a failed attempt below
    // refunds the spent credit and should not also grant discount eligibility for nothing.
    await addDiscountableCredit(user.uid);
    // So a task that later fails gets its credit back -- see refundFailedGeneration.
    await recordGenerationHold(taskId, user.uid);

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error("generate-model/confirm failed", error);
    await refundCredit(user.uid);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
