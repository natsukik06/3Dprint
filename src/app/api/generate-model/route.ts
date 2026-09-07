import { NextResponse, type NextRequest } from "next/server";
import { checkAndConsumeFreeGeneration, refundFreeGeneration } from "@/lib/credits";
import { generateWhiteClayViews, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/orders";
import { readPetDetails } from "@/lib/petDetails";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import { POSE_OPTIONS, SUBJECT_TYPE_OPTIONS, type Pose, type SubjectType } from "@/types/order";

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
  const subjectTypeRaw = formData.get("subjectType");
  const subjectType: SubjectType = SUBJECT_TYPE_OPTIONS.includes(
    subjectTypeRaw as SubjectType
  )
    ? (subjectTypeRaw as SubjectType)
    : "pet";

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
  const allowed = await checkAndConsumeFreeGeneration(user.uid);
  if (!allowed) {
    return NextResponse.json(
      { error: "本日の無料プレビュー回数（2回）を使い切りました。また明日お試しいただくか、ご注文いただくとリセットされます。" },
      { status: 429 }
    );
  }

  try {
    const referencePhotos = await Promise.all(photoFiles.map(toImagePayload));
    const petDetails = readPetDetails(formData);

    const [whiteClayViews, referenceImageUrls] = await Promise.all([
      generateWhiteClayViews(referencePhotos, subject, pose as Pose, petDetails, subjectType),
      uploadReferencePhotos(photoFiles),
    ]);

    // Generating these four views is free (up to the daily limit checked above) -- the paid
    // credit is spent later, in /api/generate-model/confirm, only once the customer has reviewed
    // these views and commits to the actual (paid) Tripo reconstruction.
    return NextResponse.json({ views: whiteClayViews, referenceImageUrls });
  } catch (error) {
    console.error("generate-model failed", error);
    await refundFreeGeneration(user.uid);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
