import { NextResponse, type NextRequest } from "next/server";
import { consumeCredit, refundCredit } from "@/lib/credits";
import {
  generateWhiteClayViews,
  VIEWS,
  type ImagePayload,
} from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/orders";
import { createMultiviewTask, uploadImageToTripo } from "@/lib/tripo";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import { POSE_OPTIONS, type Pose } from "@/types/order";

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.type.startsWith("image/");
}

async function toImagePayload(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: file.type };
}

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const formData = await request.formData();
  const photoFiles = formData.getAll("photos").filter(isImageFile);
  const subject = formData.get("subject");
  const pose = formData.get("pose");

  if (photoFiles.length === 0) {
    return NextResponse.json(
      { error: "写真を1枚以上アップロードしてください" },
      { status: 400 }
    );
  }
  if (typeof subject !== "string" || subject.trim().length === 0) {
    return NextResponse.json(
      { error: "何を作りたいか入力してください" },
      { status: 400 }
    );
  }
  if (typeof pose !== "string" || !POSE_OPTIONS.includes(pose as Pose)) {
    return NextResponse.json(
      { error: "ポーズを選択してください" },
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
    const referencePhotos = await Promise.all(photoFiles.map(toImagePayload));

    const [whiteClayViews, referenceImageUrls] = await Promise.all([
      generateWhiteClayViews(referencePhotos, subject, pose as Pose),
      uploadReferencePhotos(photoFiles),
    ]);

    const viewTokens = await Promise.all(
      VIEWS.map((view) => {
        const image = whiteClayViews[view];
        return uploadImageToTripo(
          Buffer.from(image.data, "base64"),
          `${view}.png`,
          image.mimeType
        );
      })
    );

    const taskId = await createMultiviewTask({
      front: viewTokens[0],
      left: viewTokens[1],
      back: viewTokens[2],
      right: viewTokens[3],
    });

    return NextResponse.json({ taskId, referenceImageUrls });
  } catch (error) {
    console.error("generate-model failed", error);
    await refundCredit(user.uid);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
