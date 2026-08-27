import { NextResponse, type NextRequest } from "next/server";
import { consumeCredit, refundCredit } from "@/lib/credits";
import { generateWhiteClayViews, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/orders";
import { readPetDetails } from "@/lib/petDetails";
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
    const petDetails = readPetDetails(formData);

    const [whiteClayViews, referenceImageUrls] = await Promise.all([
      generateWhiteClayViews(referencePhotos, subject, pose as Pose, petDetails),
      uploadReferencePhotos(photoFiles),
    ]);

    // The credit is spent here, on the Gemini call -- the Tripo reconstruction itself happens
    // later from /api/generate-model/confirm, once the customer has reviewed these four views and
    // approved the shape, so a bad turnaround doesn't waste a paid Tripo run.
    return NextResponse.json({ views: whiteClayViews, referenceImageUrls });
  } catch (error) {
    console.error("generate-model failed", error);
    await refundCredit(user.uid);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
