import { NextResponse, type NextRequest } from "next/server";
import { generateFinishedPreview, type ImagePayload } from "@/lib/gemini";
import { uploadFinishedPreview } from "@/lib/orders";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  MAGIC_COLOR_OPTIONS,
  POSE_OPTIONS,
  type MagicColor,
  type Pose,
} from "@/types/order";

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
  const magicColor = formData.get("magicColor");

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
  if (
    typeof magicColor !== "string" ||
    !MAGIC_COLOR_OPTIONS.includes(magicColor as MagicColor)
  ) {
    return NextResponse.json(
      { error: "魔法のカラーを選択してください" },
      { status: 400 }
    );
  }

  try {
    const referencePhotos = await Promise.all(photoFiles.map(toImagePayload));
    const finishedPreview = await generateFinishedPreview(
      referencePhotos,
      subject,
      pose as Pose,
      magicColor as MagicColor
    );

    const previewId = crypto.randomUUID();
    const previewUrl = await uploadFinishedPreview(
      Buffer.from(finishedPreview.data, "base64"),
      previewId
    );

    return NextResponse.json({ previewUrl });
  } catch (error) {
    console.error("generate-preview failed", error);
    return NextResponse.json(
      { error: "完成イメージの生成に失敗しました" },
      { status: 502 }
    );
  }
}
