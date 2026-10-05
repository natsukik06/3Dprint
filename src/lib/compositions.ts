// Preset composition (構図) references. Each image is a plain gray clay silhouette used ONLY to
// show body orientation / arrangement -- see compositionPhrase in gemini.ts. Files live in
// public/compositions/<id>.png.
export type CompositionKind = "duo" | "single";

export type CompositionPreset = {
  id: string;
  label: string;
  kind: CompositionKind;
  imageUrl: string;
};

function preset(id: string, label: string, kind: CompositionKind): CompositionPreset {
  return { id, label, kind, imageUrl: `/compositions/${id}.png` };
}

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  preset("side-by-side", "ならんで座る", "duo"),
  preset("snuggled", "くっついて座る", "duo"),
  preset("one-behind-other", "ひとりが後ろ", "duo"),
  preset("facing-each-other", "むかい合う", "duo"),
  preset("lying-together", "ならんで伏せる", "duo"),
  preset("sit-front", "すわって正面", "single"),
  preset("lie-down", "ふせる", "single"),
  preset("stand-side", "立って横向き", "single"),
];

export const DUO_COMPOSITIONS = COMPOSITION_PRESETS.filter((c) => c.kind === "duo");
export const SINGLE_COMPOSITIONS = COMPOSITION_PRESETS.filter((c) => c.kind === "single");

export function isCompositionId(value: unknown): value is string {
  return typeof value === "string" && COMPOSITION_PRESETS.some((c) => c.id === value);
}

export const MAX_COMPOSITION_IMAGE_BYTES = 8 * 1024 * 1024;

export const COMPOSITION_NOTE =
  "構図の画像からは、体の向きと並び方だけを使います。ペットの見た目は、アップしていただいたペットの写真だけで決めます";
