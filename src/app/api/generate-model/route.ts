import { NextResponse, type NextRequest } from "next/server";
import {
  checkAndConsumeGenerationAllowance,
  refundGenerationAllowance,
} from "@/lib/credits";
import { analyzeShapeRisk, generateWhiteClayViews, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/storageServer";
import { readCompositionRef } from "@/lib/compositionServer";
import { readPetDetails } from "@/lib/petDetails";
import { guardTripoCapacity } from "@/lib/tripoCapacity";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  MODEL_STYLE_OPTIONS,
  POSE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type ModelStyle,
  type Pose,
  type SubjectType,
} from "@/types/order";

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.type.startsWith("image/");
}

async function toImagePayload(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: file.type };
}

async function fetchImagePayload(url: string): Promise<ImagePayload> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch reference image (${res.status}): ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: res.headers.get("content-type") ?? "image/png" };
}

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Paused (503) while the Tripo account is out of credits -- see guardTripoCapacity.
  const paused = await guardTripoCapacity();
  if (paused) return paused;

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
  const modelStyleRaw = formData.get("modelStyle");
  const modelStyle: ModelStyle = MODEL_STYLE_OPTIONS.includes(modelStyleRaw as ModelStyle)
    ? (modelStyleRaw as ModelStyle)
    : "deformed";
  const wantsSelfStanding = formData.get("wantsSelfStanding") === "true";

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
  const composition = await readCompositionRef(formData);
  if (!composition.ok) {
    return NextResponse.json({ error: composition.error }, { status: 400 });
  }
  const { allowed, usedPreviewCredit } = await checkAndConsumeGenerationAllowance(user.uid);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "本日の無料プレビュー回数（2回）を使い切りました。また明日お試しいただくか、ご注文いただくとリセットされます。",
        freeGenerationLimitReached: true,
      },
      { status: 429 }
    );
  }

  const checkHollowFill = formData.get("checkHollowFill") === "true";
  // The server downloads this URL, so it must be one of this shop's own stored images -- never an
  // arbitrary address a caller chose.
  const ownStorage = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/`;
  const referenceFinishedImageUrlRaw = formData.get("referenceFinishedImageUrl");
  if (
    typeof referenceFinishedImageUrlRaw === "string" &&
    referenceFinishedImageUrlRaw &&
    !referenceFinishedImageUrlRaw.startsWith(ownStorage)
  ) {
    return NextResponse.json({ error: "参照画像が正しくありません" }, { status: 400 });
  }
  const referenceFinishedImageUrl =
    typeof referenceFinishedImageUrlRaw === "string" && referenceFinishedImageUrlRaw
      ? referenceFinishedImageUrlRaw
      : null;

  try {
    // The 4-direction turnaround now anchors on the customer's already-generated, already-
    // approved color completion (the first one they made) instead of the raw uploaded photo --
    // keeps the shape that becomes the actual 3D model visually consistent with what they saw in
    // the finished-look preview, rather than the two being independent generations off the same
    // source photo with different prompts/styles. Falls back to the raw photos if for some reason
    // no finished image was passed (shouldn't happen: the button that triggers this is only
    // enabled once at least one preview has succeeded).
    const referencePhotos: ImagePayload[] = referenceFinishedImageUrl
      ? [await fetchImagePayload(referenceFinishedImageUrl)]
      : await Promise.all(photoFiles.map(toImagePayload));
    const petDetails = readPetDetails(formData);

    const [whiteClayViews, referenceImageUrls] = await Promise.all([
      generateWhiteClayViews(
        referencePhotos,
        subject,
        pose as Pose,
        petDetails,
        subjectType,
        modelStyle,
        wantsSelfStanding,
        composition.payload
      ),
      uploadReferencePhotos(photoFiles),
    ]);

    // Best-effort -- a failed risk read shouldn't block a successful shape generation, it just
    // means the customer doesn't get the extra heads-up this time.
    const riskAssessment = await analyzeShapeRisk(whiteClayViews, checkHollowFill).catch(
      (error) => {
        console.error("analyzeShapeRisk failed", error);
        return null;
      }
    );

    // Generating these four views is free (up to the daily limit) or spends a ¥50 preview credit
    // (see checkAndConsumeGenerationAllowance) -- the paid model credit is spent later, in
    // /api/generate-model/confirm, only once the customer commits to the actual Tripo
    // reconstruction.
    return NextResponse.json({ views: whiteClayViews, referenceImageUrls, riskAssessment });
  } catch (error) {
    console.error("generate-model failed", error);
    await refundGenerationAllowance(user.uid, usedPreviewCredit);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
