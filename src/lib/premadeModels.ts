import type { GeneratedModel } from "@/components/order/PreviewPanel";

// The brand mascot, generated once from public/logo-full.png via the same Gemini+Tripo pipeline
// customer photos go through, then hosted permanently in Storage -- see the "前に作ったモデルから
// 始める" reuse flow in OrderForm/PreviewPanel, which this piggybacks on as an always-available,
// always-first entry (no login, no generation, no credit spend needed to select it).
export const CHARO_PREMADE_MODEL: GeneratedModel = {
  taskId: "charo-premade",
  modelUrl:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade.glb?alt=media&token=a842720e-e2f6-4705-98de-30e3f475f5e8",
  renderedImageUrl:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade.png?alt=media&token=7d27bc8a-cf82-4aa2-bfd1-8e7fa79ea6f0",
  // A representative spread, not all 11 colors -- PreviewPanel's "reuse" mode already renders a
  // graceful "この色の完成イメージはありません" placeholder for any color without a cached
  // preview, so the rest can be filled in later the same way (see
  // tmp-generate-charo-colors.ts-style script) without this needing to be exhaustive up front.
  finishedPreviewUrls: {
    starryBlue:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-starryBlue.png?alt=media&token=3270947a-0719-4f24-a0fa-8c64c0c403f0",
    nebulaPink:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-nebulaPink.png?alt=media&token=073c0d6c-c4ff-4e8f-a819-d63b384ac73d",
    galaxyGreen:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-galaxyGreen.png?alt=media&token=9be54e20-2dce-48c9-a32d-eeca522c9dfb",
    pureClear:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-pureClear.png?alt=media&token=aff312d6-4162-4107-985c-88ad44f147f6",
    cometOrange:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-cometOrange.png?alt=media&token=590cb334-29ca-49c9-a762-d30ad3bc1cce",
  },
  referenceImageUrls: [],
  subject: "ちゃろ",
  pose: "sitting",
};

// The brand mascot's realistic version -- a hand-sculpted model (not AI-generated), lightened for the
// web and hosted permanently under models/charo-premade* (the nightly cleanup never touches that
// prefix). Selectable next to the cute version in the reuse flow.
export const CHARO_REAL_PREMADE_MODEL: GeneratedModel = {
  taskId: "charo-premade-real",
  modelUrl:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-real.glb?alt=media&token=34fbd5af-2d30-46ad-b982-8982a09498f7",
  renderedImageUrl:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-real.png?alt=media&token=7ed24b6c-44b4-47d0-9e39-50bba5ed4f14",
  finishedPreviewUrls: {},
  referenceImageUrls: [],
  subject: "ちゃろ（リアル）",
  pose: "sitting",
};

export const PREMADE_MODELS: GeneratedModel[] = [CHARO_PREMADE_MODEL, CHARO_REAL_PREMADE_MODEL];

// True when `url` is one of the shop's ready-made figures (as opposed to a model made from the customer's
// own photos). Compared without the query string, since the Storage links carry an access token.
const stripQuery = (url: string) => url.split("?")[0];
export function isPremadeModelUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const target = stripQuery(url);
  return PREMADE_MODELS.some((m) => stripQuery(m.modelUrl) === target);
}
