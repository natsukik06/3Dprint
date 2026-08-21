import { GoogleGenAI, Modality } from "@google/genai";
import type { MagicColor, Pose } from "@/types/order";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type View = "front" | "left" | "back" | "right";
export const VIEWS: View[] = ["front", "left", "back", "right"];

const VIEW_PHRASES: Record<View, string> = {
  front: "front view",
  left: "left side view",
  back: "back view (rear)",
  right: "right side view",
};

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

function whiteClayPrompt(subject: string, pose: Pose, view: View): string {
  return (
    `A highly detailed, photorealistic image of a single small matte-white clay sculpture ` +
    `of ${subject}, in ${POSE_PHRASES[pose]}. Photographed as one shot from a ${VIEWS.length}-shot ` +
    "turntable sequence: the sculpture sits on a fixed turntable at a fixed camera height and " +
    `fixed camera distance, and this frame is the ${VIEW_PHRASES[view]} of that same sequence — ` +
    "identical scale, identical framing, identical pose to the other shots in the sequence, only " +
    "the turntable rotation differs. The subject is entirely one smooth, continuous surface of " +
    "plain matte white clay: no texture, no color, no fur strands or hair detail sculpted into the " +
    "surface — simplify fur/feathers/wrinkles into smooth, gently rounded volumes the way a clay " +
    "sculptor would, since this will be 3D printed at a few centimeters tall and fine strand-like " +
    "detail would be too fragile to print. Keep every part thick and continuous; avoid thin " +
    "protrusions that taper to a point. Clean plain white background, soft even studio lighting " +
    "with no harsh shadows or reflections. 8k resolution, precise anatomical proportions, full " +
    "body visible, centered in frame, no text or watermark. Use the attached reference photos to " +
    "match the subject's shape, features, and identity."
  );
}

/** Generates all four white-clay turnaround views used for the 3D reconstruction. */
export async function generateWhiteClayViews(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose
): Promise<Record<View, ImagePayload>> {
  const client = getClient();
  const results = await Promise.all(
    VIEWS.map((view) =>
      generateImage(client, referencePhotos, whiteClayPrompt(subject, pose, view))
    )
  );
  return Object.fromEntries(VIEWS.map((view, i) => [view, results[i]])) as Record<
    View,
    ImagePayload
  >;
}

/** Generates a single "finished look" crystal-material preview image. */
export async function generateFinishedPreview(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose,
  magicColor: MagicColor
): Promise<ImagePayload> {
  const client = getClient();
  const prompt =
    `A highly detailed, photorealistic macro photography of ${subject} figurine, in ` +
    `${POSE_PHRASES[pose]}. The entire body is made of ultra-clear glass-like resin. ` +
    `The inside is filled with ${MAGIC_COLOR_PHRASES[magicColor]}. Sealed with a rustic ` +
    "wooden cork at the bottom. Cinematic lighting, centered composition, no text or " +
    "watermark. Use the attached reference photos to match the subject's shape, " +
    "features, and identity.";

  return generateImage(client, referencePhotos, prompt);
}
