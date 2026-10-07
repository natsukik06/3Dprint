import { NextResponse, type NextRequest } from "next/server";
import { saveImageSet } from "@/lib/imageSets";
import {
  checkAndConsumeGenerationAllowance,
  refundGenerationAllowance,
} from "@/lib/credits";
import { generatePoseSetViews, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/storageServer";
import { readPetDetails } from "@/lib/petDetails";
import { guardTripoCapacity } from "@/lib/tripoCapacity";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  MODEL_STYLE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type ModelStyle,
  type SubjectType,
} from "@/types/order";

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.type.startsWith("image/");
}

async function toImagePayload(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: file.type };
}

// "5ポーズセット" -- unlike the single-subject and duo flows above, this doesn't ask the customer
// to pick ONE pose: one Gemini call (generatePoseSetViews) produces all 5 POSE_OPTIONS of the same
// subject as a single 2x3 grid image, split locally into 5 single-view images. Still counts as one
// (free-tier or ¥50-credit) generation from the customer's point of view -- see
// checkAndConsumeGenerationAllowance -- since it's priced/sold as one bundled 5-figure set, not 5
// separate generations, and it's also only one Gemini call under the hood now (not 5).
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

  const { allowed, usedPreviewCredit } = await checkAndConsumeGenerationAllowance(user.uid);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "本日の無料プレビュー回数（6回）を使い切りました。また明日お試しいただくか、ご注文いただくとリセットされます。",
        freeGenerationLimitReached: true,
      },
      { status: 429 }
    );
  }

  try {
    const referencePhotos = await Promise.all(photoFiles.map(toImagePayload));
    const petDetails = readPetDetails(formData);

    // No analyzeShapeRisk call here -- it expects a 4-angle turnaround (front/left/back/right) to
    // judge fragility/hollow-fill risk from multiple sides, but each pose here is only a single
    // view, so that check doesn't carry over. Revisit if this product ever gets its own
    // single-view-appropriate risk check.
    const [poseViews, referenceImageUrls] = await Promise.all([
      generatePoseSetViews(referencePhotos, subject, petDetails, subjectType, modelStyle),
      uploadReferencePhotos(photoFiles),
    ]);

    await saveImageSet(user.uid, {
      kind: "poseset",
      style: modelStyle,
      subject,
      images: poseViews,
      referenceImageUrls,
    });
    return NextResponse.json({ poseViews, referenceImageUrls });
  } catch (error) {
    console.error("generate-model-poseset failed", error);
    await refundGenerationAllowance(user.uid, usedPreviewCredit);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
