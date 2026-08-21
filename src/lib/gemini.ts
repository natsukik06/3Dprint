import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import type { MagicColor, PetDetails, Pose } from "@/types/order";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type View = "front" | "left" | "back" | "right";
export const VIEWS: View[] = ["front", "left", "back", "right"];

const POSE_PHRASES: Record<Pose, string> = {
  sitting: "a sitting pose",
  standing: "a standing pose",
  lying: "a lying down pose",
  asPhoto: "the same pose as shown in the reference photos",
  auto: "a natural, well-balanced pose",
};

const MAGIC_COLOR_PHRASES: Record<MagicColor, string> = {
  starryBlue: "deep blue liquid mixed with glowing silver glitter",
  galaxyGreen: "glowing phosphorescent green liquid mixed with sparkling stardust",
  clearAurora: "iridescent, clear aurora-like swirls with soft rainbow glitter",
  furCavity: "",
};

export type ImagePayload = { data: string; mimeType: string };

// Photos alone often don't convey things like "fur is dyed/faded", breed identity, whether
// clothing should be removed, or a docked tail — this turns whatever the customer filled in into
// plain sentences appended to the generation prompt so those details actually reach the model.
function petDetailsPhrase(details?: PetDetails): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.furColorNote?.trim()) {
    parts.push(`fur color/pattern: ${details.furColorNote.trim()}`);
  }
  if (details.breedNote?.trim()) {
    parts.push(`breed: ${details.breedNote.trim()}`);
  }
  if (details.accessoryNote?.trim()) {
    parts.push(`clothing/accessories: ${details.accessoryNote.trim()}`);
  }
  if (details.bodyFeatureNote?.trim()) {
    parts.push(`other body features: ${details.bodyFeatureNote.trim()}`);
  }
  if (parts.length === 0) return "";
  return (
    " The customer also provided these details, which take priority over the reference photos " +
    `wherever they conflict: ${parts.join("; ")}.`
  );
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function buildReferenceParts(referencePhotos: ImagePayload[]) {
  return referencePhotos.map((photo) => ({
    inlineData: { mimeType: photo.mimeType, data: photo.data },
  }));
}

async function generateImage(
  client: GoogleGenAI,
  referencePhotos: ImagePayload[],
  prompt: string
): Promise<ImagePayload> {
  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [...buildReferenceParts(referencePhotos), { text: prompt }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini did not return an image");
  }

  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
}

// Quadrant layout used by figureGridPrompt/splitGridImage — must stay in sync.
const GRID_CELLS: Record<View, { row: 0 | 1; col: 0 | 1 }> = {
  front: { row: 0, col: 0 },
  left: { row: 0, col: 1 },
  back: { row: 1, col: 0 },
  right: { row: 1, col: 1 },
};

// Deliberately NOT flattened to plain white/no-texture: Tripo's multiview_to_model call uses
// texture:false/pbr:false so color is discarded from the final mesh anyway, but Tripo still reads
// color/shading as a shape cue during reconstruction — stripping it to white clay was removing
// information the reconstruction needs and was over-smoothing coat/fur shape in the process. Only
// the print-safety constraint (no fragile paper-thin geometry) is kept, and phrased narrowly so it
// doesn't erase the pet's actual silhouette.
function figureGridPrompt(subject: string, pose: Pose, petDetails?: PetDetails): string {
  return (
    "A single image containing a precise 2x2 grid of four photos of the same small figurine of " +
    `${subject}, in ${POSE_PHRASES[pose]}. The grid has exactly four equal-sized quadrants with no ` +
    "border, no divider lines, and no grid lines drawn — just four separate photos placed edge to " +
    "edge on a shared plain white background, each one a different rotation of the same turntable " +
    "sequence around the subject: " +
    "Top-left quadrant: front view (真正面) — camera directly facing the subject head-on, its face " +
    "pointing straight at the camera. " +
    "Top-right quadrant: left side view (真左側面) — camera rotated 90 degrees counterclockwise " +
    "from the front view, so the subject's head/nose points toward the LEFT edge of this quadrant. " +
    "Bottom-left quadrant: back view (真背面) — camera rotated a further 90 degrees to be directly " +
    "behind the subject, 180 degrees opposite the front view. " +
    "Bottom-right quadrant: right side view (真右側面) — camera rotated 90 degrees clockwise from " +
    "the front view, so the subject's head/nose points toward the RIGHT edge of this quadrant. " +
    "The left side view and right side view MUST be true mirror opposites of each other, showing " +
    "opposite flanks of the body with the head facing opposite directions — they must never end up " +
    "looking like the same side repeated twice. " +
    "All four photos show the exact same turntable photography setup: identical camera " +
    "height, identical camera distance, identical scale, identical pose — only the turntable " +
    "rotation differs between quadrants. Leave generous plain white margin around the figurine " +
    "within each quadrant so no part of it comes close to the quadrant boundary. Render the " +
    "figurine's actual colors, markings, and coat pattern as closely as possible to the reference " +
    "photos — do not simplify it to a plain or single-color material. This will be 3D printed at " +
    "only a few centimeters tall, so keep the sculpted form itself sturdy: render fur/feathers as " +
    "defined locks or tufts of a real, printable thickness rather than fine wispy individual " +
    "strands, keep every part of the body thick and continuous, and avoid any thin protrusion that " +
    "tapers down to a sharp point. Soft even studio lighting with no harsh shadows or reflections. " +
    "Precise anatomical proportions, full body visible and centered within each quadrant, no text " +
    "or watermark anywhere. Use the attached reference photos to match the subject's shape, " +
    "features, coloring, and identity exactly." +
    petDetailsPhrase(petDetails)
  );
}

async function splitGridImage(image: ImagePayload): Promise<Record<View, ImagePayload>> {
  const buffer = Buffer.from(image.data, "base64");
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) {
    throw new Error("Gemini grid image is missing dimensions");
  }
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  const entries = await Promise.all(
    VIEWS.map(async (view) => {
      const { row, col } = GRID_CELLS[view];
      const left = col === 1 ? halfW : 0;
      const top = row === 1 ? halfH : 0;
      const cropWidth = col === 1 ? width - halfW : halfW;
      const cropHeight = row === 1 ? height - halfH : halfH;
      const cropped = await sharp(buffer)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .png()
        .toBuffer();
      return [view, { data: cropped.toString("base64"), mimeType: "image/png" }] as const;
    })
  );
  return Object.fromEntries(entries) as Record<View, ImagePayload>;
}

/**
 * Generates all four turnaround views used for the 3D reconstruction as a single Gemini call
 * (one 2x2 grid image split locally), instead of four separate calls — cuts Gemini cost to a
 * quarter since pricing is flat per image regardless of what's drawn in it.
 */
export async function generateWhiteClayViews(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose,
  petDetails?: PetDetails
): Promise<Record<View, ImagePayload>> {
  const client = getClient();
  const gridImage = await generateImage(
    client,
    referencePhotos,
    figureGridPrompt(subject, pose, petDetails)
  );
  return splitGridImage(gridImage);
}

/** Generates a single "finished look" crystal-material preview image. */
export async function generateFinishedPreview(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose,
  magicColor: MagicColor,
  petDetails?: PetDetails
): Promise<ImagePayload> {
  const client = getClient();
  const interiorPhrase =
    magicColor === "furCavity"
      ? "The inside is left completely empty and hollow, ready for the owner to add " +
        "their own keepsake later. A small round cork stopper is visible on the " +
        "underside where it can be opened and resealed."
      : `The inside is filled with ${MAGIC_COLOR_PHRASES[magicColor]}. Sealed with a ` +
        "rustic wooden cork at the bottom.";
  const prompt =
    `A highly detailed, photorealistic macro photography of ${subject} figurine, in ` +
    `${POSE_PHRASES[pose]}. The entire body is made of ultra-clear glass-like resin. ` +
    `${interiorPhrase} Cinematic lighting, centered composition, no text or ` +
    "watermark. Use the attached reference photos to match the subject's shape, " +
    "features, and identity." +
    petDetailsPhrase(petDetails);

  return generateImage(client, referencePhotos, prompt);
}
