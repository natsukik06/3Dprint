import type { GeneratedModel } from "@/components/order/PreviewPanel";

// 既製品の犬種シリーズ (realistic, sitting) -- the 10 most popular dog breeds in Japan, in popularity order
// (see company/drafts/ready-made/series-plan.md; the middle ranks are partly unconfirmed). Each model was made from
// a text-only generation (no customer photo) and is stored under models/charo-premade-* so the nightly
// cleanup of shipped orders never deletes it.
export const BREED_PREMADE_MODELS: GeneratedModel[] = [
  {
    taskId: "premade-breed-toy-poodle",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-toy-poodle.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-toy-poodle.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "トイ・プードル",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-chihuahua",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-chihuahua.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-chihuahua.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "チワワ",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-shiba",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-shiba.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-shiba.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "柴犬",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-mini-dachshund",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-mini-dachshund.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-mini-dachshund.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "ミニチュア・ダックスフンド",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-pomeranian",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-pomeranian.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-pomeranian.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "ポメラニアン",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-french-bulldog",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-french-bulldog.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-french-bulldog.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "フレンチ・ブルドッグ",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-mini-schnauzer",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-mini-schnauzer.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-mini-schnauzer.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "ミニチュア・シュナウザー",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-maltese",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-maltese.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-maltese.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "マルチーズ",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-golden-retriever",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-golden-retriever.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-golden-retriever.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "ゴールデン・レトリーバー",
    pose: "sitting",
  },
  {
    taskId: "premade-breed-yorkshire-terrier",
    modelUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/models%2Fcharo-premade-breed-yorkshire-terrier.glb?alt=media",
    renderedImageUrl: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-breed-yorkshire-terrier.webp?alt=media",
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject: "ヨークシャー・テリア",
    pose: "sitting",
  },
];

// 写真をもとに作り直した犬種（リアル／かわいい の2種類）。Pexels の無料写真を「参考」にして、似た別の犬を生成したもの
// （写真そのものは使っていません）。順番は、犬種ごとにリアル→かわいい。
const BUCKET = "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o";
function photoBased(slug: string, subject: string): GeneratedModel {
  return {
    taskId: `premade-breed-${slug}`,
    modelUrl: `${BUCKET}/models%2Fcharo-premade-breed-${slug}.glb?alt=media`,
    renderedImageUrl: `${BUCKET}/previews%2Fcharo-premade-breed-${slug}.webp?alt=media`,
    finishedPreviewUrls: {},
    referenceImageUrls: [],
    subject,
    pose: "sitting",
  };
}
export const PHOTO_BASED_BREED_MODELS: GeneratedModel[] = [
  photoBased("shiba-real", "柴犬（リアル）"),
  photoBased("shiba-cute", "柴犬（かわいい）"),
  photoBased("toy-poodle-real", "トイ・プードル（リアル）"),
  photoBased("toy-poodle-cute", "トイ・プードル（かわいい）"),
  photoBased("dachshund-real", "ダックス（リアル）"),
  photoBased("dachshund-cute", "ダックス（かわいい）"),
  photoBased("mini-schnauzer-real", "ミニチュア・シュナウザー（リアル）"),
  photoBased("mini-schnauzer-cute", "ミニチュア・シュナウザー（かわいい）"),
  photoBased("maltese-real", "マルチーズ（リアル）"),
  photoBased("maltese-cute", "マルチーズ（かわいい）"),
  photoBased("golden-retriever-real", "ゴールデン・レトリーバー（リアル）"),
  photoBased("golden-retriever-cute", "ゴールデン・レトリーバー（かわいい）"),
  photoBased("puppy-mix-real", "子犬ミックス（リアル）"),
  photoBased("puppy-mix-cute", "子犬ミックス（かわいい）"),
];

// 上の作り直しで置きかえた、最初の版（買えるものとしては出さないが、すでにカートに入っていても既製品として扱う）
export const REPLACED_BREED_TASK_IDS = new Set([
  "premade-breed-shiba",
  "premade-breed-toy-poodle",
  "premade-breed-mini-dachshund",
  "premade-breed-mini-schnauzer",
  "premade-breed-maltese",
  "premade-breed-golden-retriever",
]);