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
