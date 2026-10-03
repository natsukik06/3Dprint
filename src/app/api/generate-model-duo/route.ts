import { NextResponse, type NextRequest } from "next/server";
import {
  checkAndConsumeGenerationAllowance,
  refundGenerationAllowance,
} from "@/lib/credits";
import { analyzeShapeRisk, generateWhiteClayViewsDuo, type ImagePayload } from "@/lib/gemini";
import { uploadReferencePhotos } from "@/lib/orders";
import { readPetDetails } from "@/lib/petDetails";
import { guardTripoCapacity } from "@/lib/tripoCapacity";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  SCENE_LAYOUT_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type SceneLayout,
  type SubjectType,
} from "@/types/order";

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

  if (photoFilesA.length === 0 || photoFilesB.length === 0) {
    return NextResponse.json(
      { error: "2匹それぞれの写真を1枚以上アップロードしてください" },
      { status: 400 }
    );
  }
  if (typeof subjectA !== "string" || subjectA.trim().length === 0) {
    return NextResponse.json(
      { error: "1匹目が何かを入力してください" },
      { status: 400 }
    );
  }
  if (typeof subjectB !== "string" || subjectB.trim().length === 0) {
    return NextResponse.json(
      { error: "2匹目が何かを入力してください" },
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
  const checkHollowFill = formData.get("checkHollowFill") === "true";

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
        subjectType
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
