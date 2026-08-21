import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import type { MagicColor, Pose } from "@/types/order";

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

// Quadrant layout used by whiteClayGridPrompt/splitGridImage — must stay in sync.
const GRID_CELLS: Record<View, { row: 0 | 1; col: 0 | 1 }> = {
  front: { row: 0, col: 0 },
  left: { row: 0, col: 1 },
  back: { row: 1, col: 0 },
  right: { row: 1, col: 1 },
};

function whiteClayGridPrompt(subject: string, pose: Pose): string {
  return (
    "A single image containing a precise 2x2 grid of four photos of the same small matte-white " +
    `clay sculpture of ${subject}, in ${POSE_PHRASES[pose]}. The grid has exactly four equal-sized ` +
    "quadrants with no border, no divider lines, and no grid lines drawn — just four separate " +
    "photos placed edge to edge on a shared plain white background. Top-left quadrant: front view. " +
    "Top-right quadrant: left side view. Bottom-left quadrant: back view (rear). Bottom-right " +
    "quadrant: right side view. All four photos show the exact same turntable photography setup: " +
    "identical camera height, identical camera distance, identical scale, identical pose — only the " +
    "turntable rotation differs between quadrants. Leave generous plain white margin around the " +
    "sculpture within each quadrant so no part of the sculpture comes close to the quadrant " +
    "boundary. The subject is entirely one smooth, continuous surface of plain matte white clay: no " +
    "texture, no color, no fur strands or hair detail sculpted into the surface — simplify " +
    "fur/feathers/wrinkles into smooth, gently rounded volumes the way a clay sculptor would, since " +
    "this will be 3D printed at a few centimeters tall and fine strand-like detail would be too " +
    "fragile to print. Keep every part thick and continuous; avoid thin protrusions that taper to a " +
    "point. Soft even studio lighting with no harsh shadows or reflections. Precise anatomical " +
    "proportions, full body visible and centered within each quadrant, no text or watermark " +
    "anywhere. Use the attached reference photos to match the subject's shape, features, and " +
    "identity."
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
 * Generates all four white-clay turnaround views used for the 3D reconstruction as a single
 * Gemini call (one 2x2 grid image split locally), instead of four separate calls — cuts Gemini
 * cost to a quarter since pricing is flat per image regardless of what's drawn in it.
 */
export async function generateWhiteClayViews(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose
): Promise<Record<View, ImagePayload>> {
  const client = getClient();
  const gridImage = await generateImage(
    client,
    referencePhotos,
    whiteClayGridPrompt(subject, pose)
  );
  return splitGridImage(gridImage);
}

/** Generates a single "finished look" crystal-material preview image. */
export async function generateFinishedPreview(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose,
  magicColor: MagicColor
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
    "features, and identity.";

  return generateImage(client, referencePhotos, prompt);
}
