import { NextResponse, type NextRequest } from "next/server";
import { saveImageSet } from "@/lib/imageSets";
import {
  checkAndConsumeGenerationAllowance,
  refundGenerationAllowance,
} from "@/lib/credits";
import { analyzeShapeRisk, generateWhiteClayViewsDuo, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/storageServer";
import { readCompositionRef } from "@/lib/compositionServer";
import { readPetDetails } from "@/lib/petDetails";
import { guardTripoCapacity } from "@/lib/tripoCapacity";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  MODEL_STYLE_OPTIONS,
  SCENE_LAYOUT_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type ModelStyle,
  type SceneLayout,
  type SubjectType,
} from "@/types/order";

// Generation (~25s) + auto-check + at most one regeneration (~25s) + risk check: well under this,
// but the default limit could be tight now that a second image can be generated.
export const maxDuration = 120;

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.type.startsWith("image/");
}

async function toImagePayload(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: file.type };
}

// "おそろいセット" -- mirrors /api/generate-model, but takes two subjects (each with their own
// photos) and a layout choice, and produces one combined turnaround grid via
// generateWhiteClayViewsDuo instead of one single-subject grid. Shares the same free-daily /
// ¥50-preview-credit allowance as the single-subject flow (see checkAndConsumeGenerationAllowance)
// -- this is still just one shape-preview generation from the customer's point of view.
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // Paused (503) while the Tripo account is out of credits -- see guardTripoCapacity.
  const paused = await guardTripoCapacity();
  if (paused) return paused;

  const formData = await request.formData();
  const photoFilesA = formData.getAll("photosA").filter(isImageFile);
  const photoFilesB = formData.getAll("photosB").filter(isImageFile);
  const subjectA = formData.get("subjectA");
  const subjectB = formData.get("subjectB");
  const layoutRaw = formData.get("layout");
  const subjectTypeRaw = formData.get("subjectType");
  const subjectType: SubjectType = SUBJECT_TYPE_OPTIONS.includes(
    subjectTypeRaw as SubjectType
  )
    ? (subjectTypeRaw as SubjectType)
    : "pet";

  if (photoFilesA.length > 5 || photoFilesB.length > 5) {
    return NextResponse.json({ error: "写真は1匹につき5枚までです" }, { status: 400 });
  }
  if (photoFilesA.length === 0 || photoFilesB.length === 0) {
    return NextResponse.json(
      { error: "2匹それぞれの写真を1枚以上アップロードしてください" },
      { status: 400 }
    );
  }
  if (typeof subjectA !== "string" || subjectA.trim().length === 0) {
    return NextResponse.json(
      { error: "1匹目のお名前を入力してください" },
      { status: 400 }
    );
  }
  if (typeof subjectB !== "string" || subjectB.trim().length === 0) {
    return NextResponse.json(
      { error: "2匹目のお名前を入力してください" },
      { status: 400 }
    );
  }
  if (
    typeof layoutRaw !== "string" ||
    !SCENE_LAYOUT_OPTIONS.includes(layoutRaw as SceneLayout)
  ) {
    return NextResponse.json(
      { error: "配置を選択してください" },
      { status: 400 }
    );
  }
  const layout = layoutRaw as SceneLayout;
  const modelStyleRaw = formData.get("modelStyle");
  const modelStyle: ModelStyle = MODEL_STYLE_OPTIONS.includes(modelStyleRaw as ModelStyle)
    ? (modelStyleRaw as ModelStyle)
    : "deformed";
  const checkHollowFill = formData.get("checkHollowFill") === "true";

  const composition = await readCompositionRef(formData);
  if (!composition.ok) {
    return NextResponse.json({ error: composition.error }, { status: 400 });
  }
  const presetCompositionId = formData.get("compositionId");
  const upload = formData.get("compositionImage");
  const hasUploadedComposition = upload instanceof File && upload.size > 0;
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
    const [referencePhotosA, referencePhotosB] = await Promise.all([
      Promise.all(photoFilesA.map(toImagePayload)),
      Promise.all(photoFilesB.map(toImagePayload)),
    ]);
    const petDetailsA = readPetDetails(formData, "a_");
    const petDetailsB = readPetDetails(formData, "b_");

    const [whiteClayViews, referenceImageUrlsA, referenceImageUrlsB] = await Promise.all([
      generateWhiteClayViewsDuo(
        referencePhotosA,
        referencePhotosB,
        subjectA,
        subjectB,
        layout,
        petDetailsA,
        petDetailsB,
        subjectType,
        composition.payload,
        typeof presetCompositionId === "string" && !hasUploadedComposition
          ? presetCompositionId
          : undefined,
        undefined,
        modelStyle
      ),
      uploadReferencePhotos(photoFilesA),
      uploadReferencePhotos(photoFilesB),
    ]);

    const riskAssessment = await analyzeShapeRisk(whiteClayViews, checkHollowFill).catch(
      (error) => {
        console.error("analyzeShapeRisk failed", error);
        return null;
      }
    );

    await saveImageSet(user.uid, {
      kind: "duo",
      style: modelStyle,
      subject: `${subjectA}・${subjectB}`,
      images: whiteClayViews,
      referenceImageUrls: [...referenceImageUrlsA, ...referenceImageUrlsB],
      riskAssessment,
    });
    return NextResponse.json({
      views: whiteClayViews,
      referenceImageUrls: [...referenceImageUrlsA, ...referenceImageUrlsB],
      riskAssessment,
    });
  } catch (error) {
    console.error("generate-model-duo failed", error);
    await refundGenerationAllowance(user.uid, usedPreviewCredit);
    return NextResponse.json(
      { error: "3Dモデル生成の開始に失敗しました" },
      { status: 502 }
    );
  }
}
