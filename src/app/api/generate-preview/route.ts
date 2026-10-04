import { NextResponse, type NextRequest } from "next/server";
import { getColorSettings } from "@/lib/colorSettingsAdmin";
import { consumeFinishedPreviewAllowance, refundFinishedPreviewAllowance } from "@/lib/credits";
import { DEFAULT_COLOR_IMAGE_SRC } from "@/lib/colorSwatches";
import { generateFinishedPreview, type ImagePayload } from "@/lib/gemini";
import { uploadFinishedPreview } from "@/lib/storageServer";
import { readPetDetails } from "@/lib/petDetails";
import { verifyRequestUser } from "@/lib/verifyRequestUser";
import {
  ACCEPTED_IMAGE_TYPES,
  MAGIC_COLOR_OPTIONS,
  MAX_IMAGE_SIZE_BYTES,
  MAX_REFERENCE_PHOTOS,
  MODEL_STYLE_OPTIONS,
  POSE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type MagicColor,
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

// What the shop owner set up for this color in /admin/colors so the AI image can match the real
// product: a custom material description, and the swatch photo (the real finished material) as a
// reference. Best-effort -- any failure just falls back to the built-in description.
async function loadColorHints(
  color: MagicColor,
  origin: string
): Promise<{ phrase?: string; swatch?: ImagePayload } | undefined> {
  try {
    const setting = (await getColorSettings())[color];
    const hints: { phrase?: string; swatch?: ImagePayload } = {};
    if (setting.previewPrompt) hints.phrase = setting.previewPrompt;
    const swatchUrl = setting.imageUrl ?? DEFAULT_COLOR_IMAGE_SRC[color];
    if (swatchUrl) {
      const res = await fetch(new URL(swatchUrl, origin));
      if (res.ok) {
        const mimeType = res.headers.get("content-type") ?? "image/jpeg";
        if (mimeType.startsWith("image/")) {
          hints.swatch = { data: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType };
        }
      }
    }
    return hints.phrase || hints.swatch ? hints : undefined;
  } catch (error) {
    console.error("loadColorHints failed", error);
    return undefined;
  }
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
  if (photoFiles.length > MAX_REFERENCE_PHOTOS) {
    return NextResponse.json(
      { error: `写真は${MAX_REFERENCE_PHOTOS}枚までです`}, { status: 400 }
    );
  }
  if (photoFiles.some((f) => f.size > MAX_IMAGE_SIZE_BYTES || !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(f.type))) {
    return NextResponse.json({ error: "写真の形式またはサイズが対応していません" }, { status: 400 });
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

  // Daily ceiling per account on this paid AI call (see FINISHED_PREVIEWS_PER_DAY).
  if (!(await consumeFinishedPreviewAllowance(user.uid))) {
    return NextResponse.json(
      { error: "本日の完成イメージの作成回数の上限に達しました。明日またお試しください。" },
      { status: 429 }
    );
  }

  try {
    const referencePhotos = await Promise.all(photoFiles.map(toImagePayload));
    const petDetails = readPetDetails(formData);
    const colorHints = await loadColorHints(magicColor as MagicColor, request.nextUrl.origin);
    const finishedPreview = await generateFinishedPreview(
      referencePhotos,
      subject,
      pose as Pose,
      magicColor as MagicColor,
      petDetails,
      subjectType,
      modelStyle,
      wantsSelfStanding,
      colorHints
    );

    const previewId = crypto.randomUUID();
    const previewUrl = await uploadFinishedPreview(
      Buffer.from(finishedPreview.data, "base64"),
      previewId
    );

    return NextResponse.json({ previewUrl });
  } catch (error) {
    console.error("generate-preview failed", error);
    await refundFinishedPreviewAllowance(user.uid).catch(() => {});
    return NextResponse.json(
      { error: "完成イメージの生成に失敗しました" },
      { status: 502 }
    );
  }
}
