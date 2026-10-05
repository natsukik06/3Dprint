import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import type {
  MagicColor,
  ModelStyle,
  PetDetails,
  Pose,
  SceneLayout,
  SubjectType,
} from "@/types/order";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
// The image model above rejects JSON-mode requests ("JSON mode is not enabled for this model"),
// which silently broke analyzeShapeRisk for every order (its caller swallows the error and just
// shows no warning). Structured analysis of images needs a text-output multimodal model instead.
const GEMINI_ANALYSIS_MODEL = "gemini-3.8-flash";

export type View = "front" | "left" | "back" | "right";
export const VIEWS: View[] = ["front", "left", "back", "right"];

const POSE_PHRASES: Record<Pose, string> = {
  sitting: "a sitting pose",
  standing: "a standing pose",
  lying: "a lying down pose",
  asPhoto: "the same pose as shown in the reference photos",
  auto: "a natural, well-balanced pose",
};

// The plain phrases above were not enough: with "a standing pose" / "a lying down pose" the model
// kept drawing the animal sitting (the usual pose in pet photos) in nearly every generation. For a
// pet the pose is now spelled out body-part by body-part and the other poses are ruled out. Objects
// keep the plain phrase (they have no legs to describe).
const PET_POSE_PHRASES: Partial<Record<Pose, string>> = {
  sitting:
    "a SITTING pose: the animal sits upright on its haunches, bottom on the ground, front legs straight",
  standing:
    "a STANDING pose: the animal MUST be standing up on all four legs with all four paws on the " +
    "ground, body held up off the ground, four straight legs visible under the belly — it is " +
    "NOT sitting, NOT lying down and NOT crouching",
  lying:
    "a LYING-DOWN pose: the animal MUST be lying flat on its belly on the ground, body low and " +
    "touching the ground, legs tucked under or stretched forward, head resting low — it is NOT " +
    "sitting upright, NOT standing and NOT crouching",
};

function posePhrase(pose: Pose, subjectType: SubjectType): string {
  return (subjectType === "pet" ? PET_POSE_PHRASES[pose] : undefined) ?? POSE_PHRASES[pose];
}

// An explicit pose (sitting / standing / lying) must win over the model's habit of drawing a sitting
// pet; "auto" and "asPhoto" leave the model free.
function isExplicitPose(pose: Pose): boolean {
  return pose === "sitting" || pose === "standing" || pose === "lying";
}

// What the customer types into "subject" (see SubjectPoseFields.tsx) used to be spliced straight
// into the prompt as the noun describing what to generate -- so a customer who typed the wrong
// animal (or left in a placeholder example) over a correct photo got back exactly that wrong
// animal, since the explicit text overrode the attached photo. For a pet, the photo alone is
// unambiguous (a dog photo is unmistakably a dog), so the prompt no longer trusts the typed text
// as a species/description override; it's now just a name the customer picked for their own
// records (see SubjectPoseFields.tsx's relabeled field). For an object, an arbitrary item CAN be
// genuinely ambiguous from a photo alone (is it a mug or a cup?), so the typed description is
// still useful there and is kept as-is. Returns a noun phrase (no leading article) meant to drop
// into "... of SUBJECT_PHRASE, ..." or "subject A (SUBJECT_PHRASE)" -- not a full sentence.
function subjectPhrase(
  subject: string,
  subjectType: SubjectType,
  photoLabel = "the attached reference photos"
): string {
  return subjectType === "pet" ? `the pet shown in ${photoLabel}` : subject;
}

const MAGIC_COLOR_PHRASES: Record<MagicColor, string> = {
  starryBlue: "deep blue liquid mixed with glowing silver glitter",
  nebulaPink: "deep pink liquid mixed with glowing silver glitter",
  galaxyGreen: "glowing phosphorescent green liquid mixed with sparkling stardust",
  clearAurora: "iridescent, clear aurora-like swirls with soft rainbow glitter",
  cometOrange: "warm amber-orange liquid mixed with sparkling gold glitter",
  cosmicPurple: "deep violet-purple liquid mixed with glowing lavender glitter",
  marsRed: "deep red liquid mixed with glowing silver glitter",
  furCavity: "",
  pureClear: "perfectly clear, colorless liquid with no glitter, tint, or particles at all",
  smokeOnyx: "a soft smoky grey-black tint, fully transparent and glossy like smoked glass (NOT milky, cloudy or opaque), with no glitter or sparkle",
  stardustBlack: "deep black liquid mixed with glowing gold glitter",
  pureBlack: "solid opaque matte black liquid resin, a true flat black with no glitter, sparkle, or translucency",
  pureWhite: "solid opaque matte white liquid resin, a clean pure white with no glitter, sparkle, or translucency",
  clearBlue: "a pale, soft sky-blue tint, fully transparent and glossy like lightly tinted blue glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearRed: "a pale, soft red tint, fully transparent and glossy like lightly tinted red glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearYellow: "a pale, soft lemon-yellow tint, fully transparent and glossy like lightly tinted yellow glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearPink: "a pale, soft rose-pink tint, fully transparent and glossy like lightly tinted pink glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearGreen: "a pale, soft mint-green tint, fully transparent and glossy like lightly tinted green glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearPurple: "a pale, soft lavender tint, fully transparent and glossy like lightly tinted purple glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  clearOrange: "a pale, soft apricot-orange tint, fully transparent and glossy like lightly tinted orange glass (NOT milky, cloudy, opaque or frosted), with no glitter, sparkle, or particles",
  frosted: "uncoated colorless resin with a soft, cloudy frosted-glass finish (like sea glass or etched glass): milky translucent, matte with no glossy shine, so the finely sculpted fur texture reads clearly, with no glitter, sparkle, or particles",
};

// Colors whose MAGIC_COLOR_PHRASES entry says "no glitter" -- the finished-preview prompt's
// generic material sentence must not ask for glitter on these (see generateFinishedPreview).
const NO_GLITTER_COLORS: ReadonlySet<MagicColor> = new Set<MagicColor>([
  "pureClear",
  "smokeOnyx",
  "pureBlack",
  "pureWhite",
  "clearBlue",
  "clearRed",
  "clearYellow",
  "clearPink",
  "clearGreen",
  "clearPurple",
  "clearOrange",
  "frosted",
]);

// Clear resins that carry a light tint of color (the launch lineup) -- see generateFinishedPreview.
const TINT_COLORS: ReadonlySet<MagicColor> = new Set<MagicColor>([
  "smokeOnyx",
  "clearBlue",
  "clearRed",
  "clearYellow",
  "clearPink",
  "clearGreen",
  "clearPurple",
  "clearOrange",
]);

export type ImagePayload = { data: string; mimeType: string };

// Field labels for the same four detail-note inputs, phrased for whichever kind of subject this
// order is (see SUBJECT_TYPE_OPTIONS in src/types/order.ts) -- the underlying form fields
// (furColorNote/breedNote/accessoryNote/bodyFeatureNote) are reused as-is for "object" orders
// too, just re-labeled in the UI and here, rather than adding a parallel set of fields.
const DETAIL_LABELS: Record<SubjectType, Record<keyof PetDetails, string>> = {
  pet: {
    furColorNote: "fur color/pattern",
    breedNote: "breed",
    accessoryNote: "clothing/accessories",
    bodyFeatureNote: "other body features",
  },
  object: {
    furColorNote: "color/pattern",
    breedNote: "material",
    accessoryNote: "decorations/logos",
    bodyFeatureNote: "other distinguishing features (wear, chips, marks)",
  },
};

// Photos alone often don't convey things like "fur is dyed/faded", breed identity, whether
// clothing should be removed, or a docked tail (or, for an object: what it's made of, a chip in
// the handle) — this turns whatever the customer filled in into plain sentences appended to the
// generation prompt so those details actually reach the model.
function petDetailsPhrase(
  details: PetDetails | undefined,
  subjectType: SubjectType
): string {
  if (!details) return "";
  const labels = DETAIL_LABELS[subjectType];
  const parts: string[] = [];
  if (details.furColorNote?.trim()) {
    parts.push(`${labels.furColorNote}: ${details.furColorNote.trim()}`);
  }
  if (details.breedNote?.trim()) {
    parts.push(`${labels.breedNote}: ${details.breedNote.trim()}`);
  }
  if (details.accessoryNote?.trim()) {
    parts.push(`${labels.accessoryNote}: ${details.accessoryNote.trim()}`);
  }
  if (details.bodyFeatureNote?.trim()) {
    parts.push(`${labels.bodyFeatureNote}: ${details.bodyFeatureNote.trim()}`);
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
  // The image model occasionally answers 200 with no image part at all (an intermittent empty/
  // text-only reply, seen in a 20-photo test run) -- an immediate retry almost always succeeds, so
  // retry once before failing the customer's (free or paid-preview) generation attempt.
  let lastReason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [...buildReferenceParts(referencePhotos), { text: prompt }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData);
    if (imagePart?.inlineData?.data) {
      return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType ?? "image/png",
      };
    }
    const text = parts.map((part) => part.text ?? "").join(" ").trim().slice(0, 200);
    lastReason = `finishReason=${candidate?.finishReason ?? "none"}${text ? ` text="${text}"` : ""}`;
  }
  throw new Error(`Gemini did not return an image (${lastReason})`);
}

// Only what the subject is actually wearing may appear. Props around the subject in the customer's
// photo (baskets, blankets, mats, furniture, toys, bowls, leashes, people, other animals) would end up
// fused into the 3D print, so they are explicitly left out.
const OMIT_SURROUNDINGS_PHRASE =
  " Draw ONLY the subject itself and anything it is actually wearing (collar, clothing, hat, ribbon, " +
  "harness). Leave out everything that merely surrounds it in the reference photos: baskets, blankets, " +
  "mats, cushions, furniture, toys, food, bowls, leashes held by a person, plants, background scenery, " +
  "and any people or other animals that are not one of the requested subjects. Plain empty white " +
  "background only.";
// Shared style anchor for both figureGridPrompt and figureGridPromptDuo -- pins the output to a
// recognizable, well-represented aesthetic category (gashapon/mascot figurines) instead of just
// saying "figurine", which on its own wasn't stopping the model from drifting toward a
// photorealistic photo of a real living animal, especially in the two-subject (duo) case.
const TOY_STYLE_PHRASE =
  "STYLE = DEFORMED (super-deformed chibi toy). This must read unmistakably as a cute, plump " +
  "hand-painted porcelain / resin designer figurine — a collectible mascot figure with a matte " +
  "ceramic-like finish and a very fine speckled grain, like the chibi figurines sold in Japanese " +
  "gashapon capsule-toy machines — and NEVER as a photograph or realistic sculpture of " +
  "a real living animal or object. Strongly exaggerated, simplified, rounded forms: the whole " +
  "figure is only about 2 to 2.5 heads tall, with an oversized round head that is as big as the " +
  "entire body (the head is clearly bigger than the little body, even for slim or long-legged " +
  "or long-haired animals — redraw the body small, round and short, never the real animal's proportions; the legs are NOT long and the chest is NOT broad — a tiny sitting bean-shaped body under a giant head); the ears are large and stand up tall and wide, sculpted as clean pointed or " +
  "rounded shapes (with a soft pink inside if the animal has pale inner ears); huge, round, " +
  "very glossy black bead eyes with one clear white highlight, set low and wide apart; a tiny " +
  "simple nose and a small gentle mouth; short, thick, stubby tube-like legs with rounded paw ends; a small " +
  "plump rounded body. Any fluffy chest, neck ruff or cheek fur is sculpted as bold, chunky " +
  "carved tufts and layered locks with a few shallow grooves — like a carved figurine (even when " +
  "the reference is a long-haired, fluffy animal: its head fur is smooth and sculpted too, " +
  "with only a few chunky pointed locks at the cheeks and ear edges), one " +
  "big sculpted ruff of chest fur with visible streaks — never " +
  "as real hair. The colors are separated cleanly and graphically (crisp edges between the " +
  "white, black, orange, gray or brown areas, as if painted on a molded figure). " +
  "The body structure stays that of a real four-legged ANIMAL, never a " +
  "human-like doll: no arms, no hands, no fingers, no upright two-legged human posture, no " +
  "standing like a person. Dogs and cats have four legs: the front legs are short thick legs " +
  "going straight down under the chest to the ground (or folded neatly together when sitting), " +
  "the hind legs are short and thick; a sitting dog/cat sits like a real animal on its haunches " +
  "with both front paws planted on the ground. Fur/feathers/skin are NOT drawn as fine individual hairs: they are " +
  "simplified into smooth, rounded, sculpted masses and a few chunky tufts, with a uniform matte " +
  "porcelain/resin surface finish (soft, slightly chalky, with a very fine even speckle grain) like a " +
  "Pop Mart / Sonny Angel designer figurine: the coat colors appear as smooth painted color " +
  "areas on a smooth molded surface, with no hair strands, no fluff and no fur fibers visible " +
  "anywhere. Do not add decorations (stars, ribbons, jewels) that the reference photos do not show. " +
  "Keep the subject's real colors, markings and " +
  "recognizable features, but the body shape must NOT follow the real animal's anatomy.";

// The alternative to TOY_STYLE_PHRASE above -- true-to-life proportions instead of a cute
// chibi/toy caricature, for the customer-facing 実写風 (realistic) style choice.
const REALISTIC_STYLE_PHRASE =
  "STYLE = REALISTIC. This must read as a faithful, true-to-life miniature sculpture of the actual subject — " +
  "anatomically accurate proportions and real body shape/silhouette exactly as it appears in " +
  "the reference photos, NOT chibi-style, NOT cartoonishly exaggerated, and NOT simplified " +
  "into a toy-like caricature. Still a sculpted three-dimensional form (never a flat " +
  "illustration or a real photograph), but the head-to-body ratio, limb length, and overall " +
  "proportions must match the real subject as closely as possible.";

function stylePhrase(style: ModelStyle): string {
  return style === "realistic" ? REALISTIC_STYLE_PHRASE : TOY_STYLE_PHRASE;
}

// Opt-in (not every pose/subject needs it -- a keychain hangs from its hardware anyway) --
// appended only when the customer asks for a piece that can also stand on its own on a shelf.
const STABILITY_PHRASE =
  " The figure must be able to stand upright on a flat surface completely on its own: keep its " +
  "center of mass low and centered over a wide, stable stance — all legs/feet (or base points) " +
  "planted solidly on the ground plane, weight evenly balanced, no pose that leans, balances on " +
  "a single narrow point, or would tip over under its own weight.";

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
function figureGridPrompt(
  subject: string,
  pose: Pose,
  petDetails: PetDetails | undefined,
  subjectType: SubjectType,
  style: ModelStyle,
  wantsSelfStanding: boolean,
  photoCount = 0,
  hasComposition = false
): string {
  // The engineering constraint (nothing print-fragile) is the same for both, just phrased in
  // terms of what actually appears on each kind of subject.
  const printSafetyPhrase =
    subjectType === "pet"
      ? "render fur/feathers as defined locks or tufts of a real, printable thickness rather " +
        "than fine wispy individual strands, keep every part of the body thick and continuous, " +
        "and avoid any thin protrusion that tapers down to a sharp point."
      : "keep every part of the object thick and continuous, and avoid any thin handle, rim, " +
        "blade, or protrusion that tapers down to a sharp or fragile edge.";
  const proportionsPhrase =
    style === "deformed" && subjectType === "pet"
      ? "Consistent chibi proportions across all four views"
      : subjectType === "pet"
        ? "Precise anatomical proportions"
        : "Precise proportions";

  return (
    "A single image containing a precise 2x2 grid of four photos of the same small " +
    (style === "deformed" ? "chibi soft-vinyl toy (sofubi) figurine, NOT a realistic animal, " : "figurine ") +
    "of " +
    `${subjectPhrase(subject, subjectType)}, in ${posePhrase(pose, subjectType)}. ` +
    (isExplicitPose(pose) && subjectType === "pet"
      ? "The pose is the most important requirement and must be identical in all four photos. "
      : "") +
    "The grid has exactly four equal-sized quadrants with no " +
    "border, no divider lines, and no grid lines drawn — just four separate photos placed edge to " +
    "edge on a shared plain white background, each one a different rotation of the same turntable " +
    "sequence around the subject: " +
    "Top-left quadrant: front view — camera directly facing the subject head-on, its face " +
    "pointing straight at the camera. " +
    "Top-right quadrant: left side view — camera rotated a full 90 degrees " +
    "counterclockwise from the front view, so the subject's head/nose points toward the LEFT edge " +
    "of this quadrant and a full flank of the body is visible in profile. This must be a genuine " +
    "90-degree rotation, NOT a slightly-turned variant of the front view — if the face is still " +
    "mostly facing the camera, the rotation has failed. " +
    "Bottom-left quadrant: back view — camera rotated a further 90 degrees to be directly " +
    "behind the subject, 180 degrees opposite the front view, showing the back/rear of the " +
    "subject with no face visible. " +
    "Bottom-right quadrant: right side view — camera rotated 90 degrees clockwise from " +
    "the front view, so the subject's head/nose points toward the RIGHT edge of this quadrant and " +
    "a full flank of the body is visible in profile, the mirror opposite of the top-right quadrant. " +
    "The left and right side views are exact mirror images of each other, both strict 90-degree " +
    "side profiles — never a rear three-quarter view and never a view from behind. " +
    "Self-check before finalizing: the top-right and bottom-right quadrants must look CLEARLY " +
    "different from each other (one profile faces left, the other faces right) — if they look " +
    "like the same angle repeated twice, redo the rotation. " +
    "All four photos show the exact same turntable photography setup: identical camera " +
    "height, identical camera distance, identical scale, identical pose — only the turntable " +
    "rotation differs between quadrants. Leave generous plain white margin around the figurine " +
    "within each quadrant so no part of it comes close to the quadrant boundary. " +
    stylePhrase(style) +
    (style === "deformed" && subjectType === "pet"
      ? " Proportions (mandatory): about 2 to 2.5 heads tall — a big round head about as wide and " +
        "as tall as the whole body, huge round black eyes with a small highlight, short chubby " +
        "stubby legs (four-legged animal body, NOT humanoid: no arms, not standing upright like a " +
        "person) and a soft plump body — and this chibi proportion applies even if the " +
        "photographed animal looks slim, long-legged or long-haired. A fluffy chest ruff or mane " +
        "becomes a simple smooth rounded bib shape, not hair. Ears and tail are short, " +
        "thick and rounded (no thin or pointed tips). Even long-haired or fluffy animals get a " +
        "clean, smooth, rounded outline built from a few big chunky tufts — no fuzzy, wispy or " +
        "hairy edge and no visible hair texture. The two eyes are big and round but clearly " +
        "separated by a gap and placed low on the face, never touching each other. The result " +
        "must look obviously different " +
        "from a realistic version of the same animal."
      : "") +
    " Render the " +
    `figurine's actual colors, markings, and ${subjectType === "pet" ? "coat pattern" : "surface pattern/texture"} as closely as possible to the ` +
    "reference photos — do not simplify it to a plain or single-color material. This will be 3D " +
    `printed at only a few centimeters tall, so keep the sculpted form itself sturdy: ${printSafetyPhrase} ` +
    "The figurine stands directly on the ground with NO turntable, NO round disc, NO pedestal, " +
    "NO plinth, NO platform and NO base of any kind under it. " +
    "Soft even studio lighting with no harsh shadows or reflections. " +
    `${proportionsPhrase}, full body visible and centered within each quadrant, no text ` +
    "or watermark anywhere (no letters, numbers, captions or labels in any language)." +
    OMIT_SURROUNDINGS_PHRASE +
    (style === "deformed" && subjectType === "pet"
      ? " Use the attached reference photos ONLY for the animal's species, coat colors, markings, " +
        "ear shape and accessories. Do NOT copy the photo's realistic body shape, proportions, " +
        "face detail, eye style or fur texture — redraw it fully as the chibi vinyl toy described " +
        "above, even if the photo itself looks like a realistic 3D render."
      : " Use the attached reference photos to match the subject's shape, " +
        "features, coloring, and identity exactly.") +
    (wantsSelfStanding ? STABILITY_PHRASE : "") +
    petDetailsPhrase(petDetails, subjectType) +
    (hasComposition
      ? compositionPhrase(photoCount, true) +
        (isExplicitPose(pose) && subjectType === "pet"
          ? ` The customer explicitly chose ${posePhrase(pose, subjectType)}. That chosen pose is ` +
            "MANDATORY and wins over the composition reference: take only the rough body " +
            "direction and head angle from the reference, never its posture. "
          : " The pose and body orientation shown in the composition reference REPLACE the pose " +
            "described earlier. ") +
        "The subject is still just the single animal from the pet photos."
      : "")
  );
}

// Optional "composition reference" (構図の参考画像): ONE extra image appended AFTER the pet photos.
// It may be a plain gray clay silhouette preset or a customer-uploaded photo of any animal, so the
// wording must make it pose/arrangement-only and never an appearance source. Returns "" when no
// composition reference is attached, so behavior without one is unchanged.
// Strips appearance information from a composition reference before it reaches the model: the
// image is flattened to grayscale and heavily blurred so only the rough silhouette / pose /
// arrangement survives (no coat color, pattern, facial detail or accessories to copy). Added after
// tests showed that an unprocessed photo of a different animal leaked its species and coat into
// the result even with a strong "do not copy" instruction.
async function neutralizeCompositionRef(image: ImagePayload): Promise<ImagePayload> {
  const out = await sharp(Buffer.from(image.data, "base64"))
    .rotate()
    .resize(512, 512, { fit: "contain", background: "#ffffff" })
    .grayscale()
    .blur(9)
    .normalise()
    .png()
    .toBuffer();
  return { data: out.toString("base64"), mimeType: "image/png" };
}

async function softenReferencePhoto(image: ImagePayload): Promise<ImagePayload> {
  try {
    const out = await sharp(Buffer.from(image.data, "base64"))
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .blur(4)
      .jpeg({ quality: 88 })
      .toBuffer();
    return { data: out.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return image;
  }
}

function compositionPhrase(photoCount: number, hasComposition: boolean): string {
  if (!hasComposition) return "";
  return (
    ` IMPORTANT - COMPOSITION REFERENCE: the attached images are ${photoCount} pet photo(s) ` +
    "followed by exactly ONE final extra image (the LAST image). That last image is a " +
    "COMPOSITION-ONLY reference: use it solely for body orientation, pose, how the animals are " +
    "arranged and their positions relative to each other (it has been deliberately turned into a " +
    "blurry gray silhouette; any missing detail or color is intentional and must NOT be " +
    "invented from it). Do NOT copy ANYTHING about the " +
    "appearance of what is drawn in that last image: not its species, breed, fur/coat color, " +
    "markings or patterns, face, ears, tail shape, accessories/clothing, material, texture or " +
    "colors. Its subject is a stand-in only (it may be a plain gray silhouette, a mannequin, or a " +
    "photo of a completely different animal - treat all of these identically). The appearance of " +
    "every animal in the output must be decided ONLY from the pet photos listed before the last " +
    "image, never from the last image. Do not include the last image's background or any " +
    "extra animals/objects from it."
  );
}

// "5ポーズセット" -- the same subject in each of the 5 POSE_OPTIONS, ONE view per pose (reconstructed
// from a single view per pose via Tripo's single-image mode). Each pose is generated as its OWN image
// (5 parallel calls): an earlier version asked for all five in one 2x3 grid and cut the result into
// equal cells, but the model does not place figures exactly in the cells, so figures were cut off or
// shifted at the edges. One figure per image can never be cropped by a neighbour's cell.
function figurePosePrompt(
  pose: Pose,
  subject: string,
  petDetails: PetDetails | undefined,
  subjectType: SubjectType
): string {
  const printSafetyPhrase =
    subjectType === "pet"
      ? "render fur/feathers as defined locks or tufts of a real, printable thickness rather " +
        "than fine wispy individual strands, keep every part of the body thick and continuous, " +
        "and avoid any thin protrusion that tapers down to a sharp point."
      : "keep every part of the object thick and continuous, and avoid any thin handle, rim, " +
        "blade, or protrusion that tapers down to a sharp or fragile edge.";
  const proportionsPhrase =
    subjectType === "pet" ? "Precise anatomical proportions" : "Precise proportions";

  return (
    "A single square photo of one small figurine of " +
    `${subjectPhrase(subject, subjectType)} on a plain white background, with no border and no ` +
    "other objects. Pose: " +
    `${POSE_PHRASES[pose]}. Photographed from a front-facing 3/4 camera angle. The whole figurine ` +
    "is fully visible and centered, with generous plain white margin on every side so no part of " +
    "it touches or comes near the image edge. " +
    TOY_STYLE_PHRASE +
    " Render the " +
    `figurine's actual colors, markings, and ${subjectType === "pet" ? "coat pattern" : "surface pattern/texture"} as closely as possible to the ` +
    "reference photos — do not simplify it to a plain or single-color material. This will be 3D " +
    `printed at only a few centimeters tall, so keep the sculpted form itself sturdy: ${printSafetyPhrase} ` +
    "Soft even studio lighting with no harsh shadows or reflections. " +
    `${proportionsPhrase}, full body visible, no text or watermark anywhere.` +
    OMIT_SURROUNDINGS_PHRASE +
    " Use the attached reference photos to match the subject's shape, features, " +
    "coloring, and identity exactly." +
    petDetailsPhrase(petDetails, subjectType)
  );
}
/**
 * Generates all 5 POSE_OPTIONS of the same subject as a single Gemini call (one 2x3 grid image,
 * split locally into 5 single-view images) -- mirrors generateWhiteClayViews's one-call-per-grid
 * approach, just posed-based instead of angle-based. Each returned image is ONE view, meant for
 * Tripo's single-image reconstruction mode (createMultiviewTask with only `front` set), not the
 * full 4-angle turnaround used for the regular single-figure product.
 */
export async function generatePoseSetViews(
  referencePhotos: ImagePayload[],
  subject: string,
  petDetails?: PetDetails,
  subjectType: SubjectType = "pet"
): Promise<Record<Pose, ImagePayload>> {
  const client = getClient();
  const poses = Object.keys(POSE_PHRASES) as Pose[];
  const images = await Promise.all(
    poses.map((pose) =>
      generateImage(client, referencePhotos, figurePosePrompt(pose, subject, petDetails, subjectType))
    )
  );
  return Object.fromEntries(poses.map((pose, i) => [pose, images[i]])) as Record<Pose, ImagePayload>;
}

const SCENE_LAYOUT_PHRASES: Record<SceneLayout, string> = {
  sideBySide:
    "sitting side by side on the same ground, their shoulders and sides pressed together so they " +
    "join into one solid piece, both facing the camera",
  snuggled:
    "sitting close together in an affectionate pose, leaning their heads and bodies against each " +
    "other so they touch along a broad area, like they belong to the same home",
  stacked:
    "sitting on the same ground, one slightly behind and diagonally beside the other so the rear " +
    "one's head peeks up a little higher next to the front one's head, bodies pressed firmly " +
    "together (nothing floating, nobody climbing on or lying across the other)",
};

// Posture wording for the preset composition references (public/compositions/*). The reference
// image itself is a blurred gray silhouette, which conveys "lying" or "snuggled" only weakly, so the
// pose is also put into words. Only used when a preset id is known (not for customer uploads).
const DUO_COMPOSITION_HINTS: Record<string, string> = {
  "side-by-side":
    "both animals sit upright side by side, shoulders touching, both facing the camera",
  snuggled:
    "both animals sit very close together, heads leaning against each other, bodies pressed together",
  "one-behind-other":
    "one animal sits in front and the other sits right behind it, its head peeking out beside the front one",
  "facing-each-other":
    "the two animals sit facing each other, noses close together, seen in profile from the front",
  "lying-together":
    "BOTH animals are lying down flat on their bellies on the ground, bodies low and touching, " +
    "heads resting low (neither one stands or sits upright)",
  "on-back":
    "animal A lies flat on its belly on the ground; animal B lies stretched out ON TOP of A's back, " +
    "chin or cheek resting on A, B's body in full contact with A's back so the two form one solid mass " +
    "(B is not floating and not standing, it is resting its weight on A)",
  "cuddle-sleep":
    "BOTH animals are curled up asleep with eyes closed, cuddled tightly together, one's head tucked " +
    "against or under the other's chin or neck, bodies pressed into one rounded mass, nobody standing or sitting upright",
};

export type DuoSpecies = "dog" | "cat" | "other" | null;

const SPECIES_SCHEMA = {
  type: "OBJECT",
  properties: {
    species: { type: "STRING", enum: ["dog", "cat", "other"] },
  },
  required: ["species"],
};

// Reads the species (dog / cat / other) of the main animal in a set of photos. The customer's typed
// name is never used for this (see subjectPhrase); the photo decides. Failure is not fatal: null
// means "unknown" and the prompt falls back to wording that does not name a species.
async function detectSpecies(client: GoogleGenAI, photos: ImagePayload[]): Promise<DuoSpecies> {
  try {
    const response = await client.models.generateContent({
      model: GEMINI_ANALYSIS_MODEL,
      contents: [
        ...buildReferenceParts(photos.slice(0, 2)),
        {
          text:
            "What kind of animal is the main pet in these photos? Answer with JSON only: " +
            "\"dog\" for any dog, \"cat\" for any cat, \"other\" for any other animal or if there is no animal.",
        },
      ],
      config: { responseMimeType: "application/json", responseSchema: SPECIES_SCHEMA },
    });
    const parsed = JSON.parse(response.text ?? "{}") as { species?: string };
    return parsed.species === "dog" || parsed.species === "cat" || parsed.species === "other"
      ? parsed.species
      : null;
  } catch {
    return null;
  }
}

// "おそろいセット" -- two different pets/objects sculpted together into ONE figurine (one
// physical piece), rather than the single-subject figureGridPrompt above. Still one 2x2
// turnaround grid, because the output is still one 3D mesh: the "subject" of the turnaround is
// now the whole two-figure scene, not one figure alone.
//
// Tuned 2026-10 by generating dog+dog / dog+cat / cat+cat pairs (see company/reports/
// 2026-10-05-ノブナガ-多頭プロンプト改善.md and ...-2匹生成の修正.md): the old wording let the two
// animals blend, drift to a realistic photo look, come out lopsided, lose one animal in some
// quadrants, turn a dog into a cat (especially with the same photo used twice), repeat the back view
// instead of showing the right profile, and draw divider lines. Kept from the 2026-10-05 re-test:
// the species of each animal is named (read from the photo), "same photo twice" gets twin wording,
// and the generic layout sentence is dropped when a composition reference is attached (plus posture
// wording for presets) so the two never conflict -- this made "lying-together" actually lie down.
// NOT improved (the stronger "mirror image" / "no lines" / "both visible in every quadrant" wording
// was tried and scored no better, see the report): one animal missing from a side view, and the
// right view repeating the back view, still happen in roughly a third of generations.
function figureGridPromptDuo(
  referencePhotoCountA: number,
  layout: SceneLayout,
  petDetailsA: PetDetails | undefined,
  petDetailsB: PetDetails | undefined,
  subjectType: SubjectType,
  photoCount = 0,
  hasComposition = false,
  extra: {
    speciesA?: DuoSpecies;
    speciesB?: DuoSpecies;
    samePhoto?: boolean;
    compositionHint?: string;
    subjectA?: string;
    subjectB?: string;
  } = {}
): string {
  const isPet = subjectType === "pet";
  const noun = isPet ? "pets" : "objects";
  const animals = isPet ? "animals" : "objects";
  const photosA = referencePhotoCountA > 1 ? `1-${referencePhotoCountA}` : "1";
  const spA = isPet ? extra.speciesA ?? null : null;
  const spB = isPet ? extra.speciesB ?? null : null;
  const word = (s: DuoSpecies, fallback: string) =>
    s === "dog" ? "DOG" : s === "cat" ? "CAT" : s === "other" ? "animal" : fallback;
  const wA = word(spA, "animal");
  const wB = word(spB, "animal");
  const samePhoto = !!extra.samePhoto && isPet;

  const subjectAPhrase = isPet
    ? `the ${wA} in reference photo(s) ${photosA}`
    : `${extra.subjectA ?? "the first object"}, shown in reference photo(s) ${photosA}`;
  const subjectBPhrase = isPet
    ? samePhoto
      ? `a second ${wB} that looks exactly like A (same photo)`
      : `the ${wB} in the remaining reference photo(s)`
    : `${extra.subjectB ?? "the second object"}, shown in the remaining reference photo(s)`;

  let identityPhrase: string;
  if (!isPet) {
    identityPhrase =
      "They are two DIFFERENT objects: keep each one's own shape, colors and decoration clearly " +
      "visible in all four views — never draw two copies of the same object and never blend them.";
  } else if (samePhoto) {
    const kind = wA === "animal" ? "kind of animal" : wA;
    identityPhrase =
      "A and B were made from the SAME photo, so they are TWINS: two copies of the very same " +
      `animal standing/sitting together, same species (a ${kind} — and ONLY that species, NEVER ` +
      "a different animal, never a cat if the photo shows a dog and never a dog if the photo " +
      "shows a cat), same face, same coat color and markings, same size. Do not invent a " +
      "different animal for B and do not change B's species or coat. ";
  } else {
    const species =
      spA && spB && spA === spB
        ? `Both are ${wA}s (the same species) but two different individuals: `
        : spA && spB
          ? `A is a ${wA} and B is a ${wB} — they stay exactly these species in every view: `
          : "";
    identityPhrase =
      "They are two DIFFERENT animals. " +
      species +
      "before drawing, note what makes them differ (coat color and markings, ear shape, " +
      "face/muzzle shape, fur length, species) and keep those differences clearly visible in all " +
      "four views — never draw two copies of the same animal, never swap or blend their " +
      "features: a dog stays a dog and a cat stays a cat with its own species-correct face " +
      "(cats: small nose, short flat muzzle, round face, pointed ears; dogs: a clear muzzle/snout), " +
      "and neither animal borrows the other's markings, ear shape or coat pattern.";
  }

  const cutenessPhrase = isPet
    ? "CUTENESS (very important): sculpt both as adorable chibi gashapon-style toys — a big " +
      "round head about as wide as the body, large glossy simple eyes set low and wide apart, " +
      "tiny nose and mouth, short chubby limbs, a soft plump rounded body, about 2 to 2.5 heads " +
      "tall. Sweet, gentle, happy faces. This chibi simplification applies even to fluffy or " +
      "long-haired animals: turn their fluff into smooth rounded toy shapes with a few soft " +
      "tufts and give them the same big glossy bead eyes, so none of them looks like a " +
      "realistic photographed animal — redraw every animal as a toy even if its reference photo " +
      "looks very realistic. Same cute chibi treatment and about the same overall size for " +
      "BOTH (neither one much larger or smaller than the other, neither hidden), each keeping " +
      "its own recognizable traits (ear shape, face markings, coat colors and patches, tail, " +
      "fur length) from its own photos. "
    : "CUTENESS: sculpt both as cute, softly rounded collectible toy versions of the real " +
      "objects, about the same overall size (neither much larger or smaller, neither hidden), " +
      "each keeping its own recognizable shape, colors and decoration from its own photos. ";
  const materialPhrase = isPet
    ? "MATERIAL: smooth matte resin toy surfaces with softly sculpted fur tufts and simple " +
      "painted-on color patches — NOT a photo of a real animal, no individual hair strands, no " +
      "photorealistic fur. "
    : "MATERIAL: smooth matte resin toy surfaces — NOT a photograph of the real objects. ";
  const structurePhrase = isPet
    ? "STRUCTURE FOR 3D PRINTING (a few cm tall keychain): the two bodies are fused together " +
      "along a broad contact area (at least a third of the body width), sitting on the same " +
      "flat ground line, with thick short legs, thick ears and a short thick tail — no thin " +
      "spindly parts, no gaps or holes, nothing floating, and NO base, plate, stand, pedestal " +
      "or disc under them. "
    : "STRUCTURE FOR 3D PRINTING (a few cm tall keychain): the two objects are fused together " +
      "along a broad contact area, resting on the same flat ground line, with every part thick " +
      "and continuous — no thin handles, rims, blades or spindly parts, no gaps or holes, " +
      "nothing floating, and NO base, plate, stand, pedestal or disc under them. ";

  // With a composition reference the arrangement comes from that image (and, for a preset, from the
  // pose wording below) -- the generic layout sentence is left out so the two cannot conflict.
  const arrangementPhrase = hasComposition
    ? "Arrangement of A and B: copy the pose and arrangement of the composition reference image" +
      (extra.compositionHint ? ` (${extra.compositionHint})` : "") +
      ", but with the animals' real species and looks from their own photos. "
    : `A and B are ${SCENE_LAYOUT_PHRASES[layout]}. `;
  const eachQuadrant = `EVERY one of the four quadrants must contain BOTH ${animals} together (never a quadrant with only one); `;
  const sideViews = hasComposition
    ? "in the side views keep the same arrangement, just turned to the side. "
    : "in the side views the two are lined up side by side along the viewing direction, one " +
      "partly overlapping the other, both facing the same way. ";

  return (
    "Create ONE image: a precise 2x2 grid of four photos of the same small kawaii collectible " +
    `figurine (a single rigid sculpture) showing TWO different ${noun} together as one combined ` +
    `piece. Subject A is ${subjectAPhrase}; subject B is ${subjectBPhrase}. ` +
    `${identityPhrase} ${arrangementPhrase}` +
    cutenessPhrase +
    materialPhrase +
    structurePhrase +
    "GRID: exactly four equal quadrants on one shared plain white background with NO border, " +
    "divider lines or grid lines. Same camera height, distance and scale in all four; the " +
    "figurine is a turntable object, only the rotation changes, and the arrangement of A and B " +
    "never changes. " +
    eachQuadrant +
    sideViews +
    "Top-left: FRONT view, both faces/fronts looking at the camera. " +
    "Top-right: LEFT-SIDE view — a true 90 degree turn so we see the full side profile of both, " +
    "both heads/fronts pointing toward the LEFT edge. " +
    "Bottom-left: BACK view, 180 degrees from the front, the rear of both, no faces. " +
    "Bottom-right: RIGHT-SIDE view — the opposite 90 degree turn, full side profile of both, " +
    "both heads/fronts pointing toward the RIGHT edge. " +
    "Think of four camera positions around the turntable at 0, 90, 180 and 270 degrees: no two " +
    "quadrants may show the same angle, and the two profile quadrants must be mirror-image " +
    "views (pointing left in one, right in the other). All four quadrants must be clearly " +
    "different angles of the same figurine. Whole figurine fully visible and centered in each " +
    "quadrant with generous white margin. Soft even studio light, no harsh shadows. No text, " +
    "letters, numbers or watermark anywhere (no captions or labels in any language). " +
    `Use each subject's own reference photos only for its own identity and coloring.` +
    OMIT_SURROUNDINGS_PHRASE +
    petDetailsPhrase(petDetailsA, subjectType) +
    petDetailsPhrase(petDetailsB, subjectType) +
    (hasComposition
      ? compositionPhrase(photoCount, true) +
        ` For this two-${animals === "animals" ? "animal" : "object"} figurine, the composition reference decides ` +
        "the arrangement, but both must still be fused into one piece with a broad contact area " +
        "and no base."
      : "")
  );
}


export type ShapeRiskAssessment = {
  fragileRisk: boolean;
  fragileReason: string;
  hollowFillRisk: boolean;
  hollowFillReason: string;
};

const SHAPE_RISK_SCHEMA = {
  type: "OBJECT",
  properties: {
    fragileRisk: {
      type: "BOOLEAN",
      description:
        "true if the shape has any part thin/slender enough to plausibly snap off during 3D " +
        "printing, handling, or shipping at a few centimeters tall (thin legs, a thin tail, thin " +
        "ears, a thin handle or protrusion, etc.)",
    },
    fragileReason: {
      type: "STRING",
      description:
        "One short sentence in Japanese naming the specific fragile part(s), e.g. " +
        "\"細い脚と尻尾の先端が折れやすい可能性があります\". Empty string if fragileRisk is false.",
    },
    hollowFillRisk: {
      type: "BOOLEAN",
      description:
        "true only if the shape's silhouette narrows down to a thin neck/waist/pinch point " +
        "partway along its body, such that liquid resin poured in through one opening could not " +
        "physically flow past that narrow point to reach the rest of the interior cavity once " +
        "hollowed out. false if the body is one continuous, gradually-tapering volume.",
    },
    hollowFillReason: {
      type: "STRING",
      description:
        "One short sentence in Japanese naming where the narrow point is, e.g. " +
        "\"首の部分が細くくびれているため、そこから先の空洞にレジンが届かない可能性があります\". " +
        "Empty string if hollowFillRisk is false.",
    },
  },
  required: ["fragileRisk", "fragileReason", "hollowFillRisk", "hollowFillReason"],
};

/**
 * Runs after the (free) turnaround-view generation, before the customer commits to the paid 3D
 * reconstruction -- lets PreviewPanel/DuoBuilder surface a specific, AI-identified warning (thin
 * parts that could snap, or a narrow waist that would block resin from reaching the far end of a
 * hollowed cavity) instead of only the generic blanket risk consent checkbox. checkHollowFill
 * should be true only for the furCavity ("毛入れ用") product, where the customer is relying on
 * the whole interior actually being reachable to pack fur into.
 */
export async function analyzeShapeRisk(
  views: Record<View, ImagePayload>,
  checkHollowFill: boolean
): Promise<ShapeRiskAssessment> {
  const client = getClient();
  const prompt =
    "You are reviewing 4 turnaround-view photos (front, left, back, right) of a small figurine " +
    "design that is about to be 3D printed at only a few centimeters tall, then " +
    (checkHollowFill
      ? "hollowed out and filled with a customer's own keepsake material (fur, small mementos) " +
        "through a small hole. "
      : "hollowed out for weight/material savings. ") +
    "Assess two specific structural risks and respond ONLY with the JSON described.";

  const response = await client.models.generateContent({
    model: GEMINI_ANALYSIS_MODEL,
    contents: [...buildReferenceParts(Object.values(views)), { text: prompt }],
    config: {
      responseMimeType: "application/json",
      responseSchema: SHAPE_RISK_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini did not return a risk assessment");
  const parsed = JSON.parse(text) as ShapeRiskAssessment;
  return {
    fragileRisk: !!parsed.fragileRisk,
    fragileReason: parsed.fragileReason ?? "",
    hollowFillRisk: checkHollowFill && !!parsed.hollowFillRisk,
    hollowFillReason: checkHollowFill ? (parsed.hollowFillReason ?? "") : "",
  };
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
  petDetails?: PetDetails,
  subjectType: SubjectType = "pet",
  style: ModelStyle = "deformed",
  wantsSelfStanding = false,
  compositionRef?: ImagePayload
): Promise<Record<View, ImagePayload>> {
  const client = getClient();
  const neutralRef = compositionRef ? await neutralizeCompositionRef(compositionRef) : undefined;
  // Deformed pets: soften the photos (small + blurred) so the model keeps colors/markings but does
  // not copy the real fur texture and realistic anatomy (tests showed fluffy long-haired pets came
  // out nearly identical to the realistic style otherwise).
  const photos =
    style === "deformed" && subjectType === "pet"
      ? await Promise.all(referencePhotos.map(softenReferencePhoto))
      : referencePhotos;
  const gridImage = await generateImage(
    client,
    neutralRef ? [...photos, neutralRef] : photos,
    figureGridPrompt(
      subject,
      pose,
      petDetails,
      subjectType,
      style,
      wantsSelfStanding,
      referencePhotos.length,
      !!compositionRef
    )
  );
  return splitGridImage(gridImage);
}

/**
 * Same idea as generateWhiteClayViews, but for "おそろいセット" -- two different subjects (each
 * with their own reference photos) sculpted together into one combined figurine/turnaround grid,
 * instead of one subject alone. referencePhotosA/referencePhotosB are sent as one combined list
 * (A's photos first) so the prompt can tell Gemini which photos belong to which subject.
 */
export async function generateWhiteClayViewsDuo(
  referencePhotosA: ImagePayload[],
  referencePhotosB: ImagePayload[],
  subjectA: string,
  subjectB: string,
  layout: SceneLayout,
  petDetailsA?: PetDetails,
  petDetailsB?: PetDetails,
  subjectType: SubjectType = "pet",
  compositionRef?: ImagePayload,
  // Id of a preset composition (e.g. "lying-together"); only adds posture wording to the prompt.
  compositionId?: string,
  // Test hook: receives the first auto-check result and whether a regeneration happened.
  onCheck?: (info: { first: DuoCheckResult | null; retried: boolean }) => void
): Promise<Record<View, ImagePayload>> {
  const client = getClient();
  const photos = [...referencePhotosA, ...referencePhotosB];
  const neutralRef = compositionRef ? await neutralizeCompositionRef(compositionRef) : undefined;
  // The same photo used for both animals (e.g. twins): needs "two copies of the same animal"
  // wording, otherwise the model invents a different animal for the second one.
  const samePhoto = referencePhotosA.some((a) =>
    referencePhotosB.some((b) => a.data === b.data)
  );
  const isPet = subjectType === "pet";
  const [speciesA, speciesB] = isPet
    ? samePhoto
      ? await detectSpecies(client, referencePhotosA).then((s) => [s, s] as const)
      : await Promise.all([
          detectSpecies(client, referencePhotosA),
          detectSpecies(client, referencePhotosB),
        ])
    : [null, null];
  const prompt = figureGridPromptDuo(
    referencePhotosA.length,
    layout,
    petDetailsA,
    petDetailsB,
    subjectType,
    photos.length,
    !!compositionRef,
    {
      speciesA,
      speciesB,
      samePhoto,
      compositionHint: compositionId ? DUO_COMPOSITION_HINTS[compositionId] : undefined,
      subjectA,
      subjectB,
    }
  );
  const refs = neutralRef ? [...photos, neutralRef] : photos;

  let views = await splitGridImage(await generateImage(client, refs, prompt));
  // Auto-check, then at most ONE regeneration. Whatever the second attempt looks like is returned
  // (no second check). A check that throws counts as "fine": the generation itself succeeded.
  // DISABLED by default (DUO_AUTO_CHECK_ENABLED): in testing the check failed every sample and the
  // regeneration fixed only 1 in 12, so it nearly doubled the cost for no gain. Kept for tests.
  const first = DUO_AUTO_CHECK_ENABLED
    ? await checkDuoViews(client, views, isPet).catch((error) => {
        console.error("checkDuoViews failed", error);
        return null;
      })
    : null;
  let retried = false;
  if (first && !first.ok) {
    retried = true;
    console.warn("duo views failed auto-check, regenerating once:", first.problems.join("; "));
    try {
      views = await splitGridImage(await generateImage(client, refs, prompt));
    } catch (error) {
      // The second attempt failed outright: keep the first result rather than failing the order.
      console.error("duo regeneration failed, keeping first result", error);
    }
  }
  onCheck?.({ first, retried });
  return views;
}

const DUO_AUTO_CHECK_ENABLED = process.env.DUO_AUTO_CHECK === "1";

export type DuoCheckResult = { ok: boolean; problems: string[] };

/** Runs the same duo auto-check on any four views (used by tests to judge the final result). */
export function checkDuoViewsOnce(
  views: Record<View, ImagePayload>,
  isPet = true
): Promise<DuoCheckResult> {
  return checkDuoViews(getClient(), views, isPet);
}

const DUO_CHECK_SCHEMA = {
  type: "OBJECT",
  properties: {
    frontCount: { type: "INTEGER" },
    leftCount: { type: "INTEGER" },
    backCount: { type: "INTEGER" },
    rightCount: { type: "INTEGER" },
    rightIsMirrorOfLeftProfile: { type: "BOOLEAN" },
    hasDividerLinesOrText: { type: "BOOLEAN" },
  },
  required: [
    "frontCount",
    "leftCount",
    "backCount",
    "rightCount",
    "rightIsMirrorOfLeftProfile",
    "hasDividerLinesOrText",
  ],
};

// Looks at the four generated views of a two-subject figurine and says whether they are usable:
// both subjects visible in every view, the right view a real side profile (the mirror of the left
// one, not a second back view), and no drawn divider lines or text. Throws on API/parse errors --
// the caller decides what that means.
async function checkDuoViews(
  client: GoogleGenAI,
  views: Record<View, ImagePayload>,
  isPet: boolean
): Promise<DuoCheckResult> {
  const thing = isPet ? "animal" : "object";
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const view of VIEWS) {
    parts.push({ text: `${view.toUpperCase()} view image:` });
    parts.push({ inlineData: { mimeType: views[view].mimeType, data: views[view].data } });
  }
  parts.push({
    text:
      `These 4 images should be the front, left, back and right turntable views of ONE figurine ` +
      `showing TWO ${thing}s together. For each image, count how many separate ${thing} figures are ` +
      `visibly present (one mostly hidden behind another but with its head or part of its body ` +
      `visible still counts). Also: is the RIGHT image a side profile in which the ${thing} faces ` +
      `are visible from the side (answer false only if it is mostly a view of the rear ends, i.e. ` +
      `a repeat of the BACK image)? Do any of the images contain drawn divider/border lines, or any ` +
      `letters, numbers or text? JSON only.`,
  });
  const response = await client.models.generateContent({
    model: GEMINI_ANALYSIS_MODEL,
    contents: parts,
    config: { responseMimeType: "application/json", responseSchema: DUO_CHECK_SCHEMA },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini did not return a duo check");
  const j = JSON.parse(text) as {
    frontCount: number;
    leftCount: number;
    backCount: number;
    rightCount: number;
    rightIsMirrorOfLeftProfile: boolean;
    hasDividerLinesOrText: boolean;
  };
  const problems: string[] = [];
  const counts: Array<[View, number]> = [
    ["front", j.frontCount],
    ["left", j.leftCount],
    ["back", j.backCount],
    ["right", j.rightCount],
  ];
  for (const [view, n] of counts) {
    if (!(n >= 2)) problems.push(`${view} shows ${n} ${thing}(s)`);
  }
  if (!j.rightIsMirrorOfLeftProfile) problems.push("right view is a repeat of the back view, not a side profile");
  if (j.hasDividerLinesOrText) problems.push("divider lines or text drawn");
  return { ok: problems.length === 0, problems };
}

/** Generates a single "finished look" crystal-material preview image. */
export async function generateFinishedPreview(
  referencePhotos: ImagePayload[],
  subject: string,
  pose: Pose,
  magicColor: MagicColor,
  petDetails?: PetDetails,
  subjectType: SubjectType = "pet",
  style: ModelStyle = "deformed",
  wantsSelfStanding = false,
  // Lets the shop owner match the AI image to what the real product looks like (see
  // /admin/colors): `phrase` replaces the built-in material description for this color, and
  // `swatch` is a photo of the real finished material, sent as an extra reference to copy the
  // color depth / translucency / finish from (never its shape).
  colorHints?: { phrase?: string; swatch?: ImagePayload }
): Promise<ImagePayload> {
  const client = getClient();
  const colorPhrase = colorHints?.phrase?.trim() || MAGIC_COLOR_PHRASES[magicColor];
  // This step now doubles as the shape reference the 4-direction turnaround is generated FROM
  // (see PreviewPanel's firstPreviewRef / /api/generate-model), so the style choice has to be
  // established here too, not just in figureGridPrompt -- otherwise the "finished image" the
  // customer approves could look realistic while the actual 3D shape still comes out deformed.
  const shapeStylePhrase =
    style === "realistic"
      ? "The sculpted shape itself must be an anatomically accurate, true-to-life miniature of " +
        "the subject -- real proportions and silhouette exactly as photographed, NOT a cute " +
        "chibi/toy caricature. "
      : "The sculpted shape itself is a cute, chibi-style toy-figurine caricature of the " +
        "subject -- simplified, rounded, and a little exaggerated in its proportions, the way " +
        "a Japanese gashapon capsule-toy mascot figure would be. ";
  const wholeSubjectPhrase =
    subjectType === "pet" ? "every part of the body, face, and fur" : "every part of the object";
  const realColoringPhrase =
    subjectType === "pet"
      ? "real fur colors, markings, or facial coloring"
      : "real surface colors, markings, or texture";
  const neverRealisticPhrase =
    subjectType === "pet"
      ? "never realistically colored/textured fur"
      : "never a realistically colored/textured surface";
  // The real tinted clear pieces are clear resin with a LIGHT tint (thin color, often applied as a
  // coating), not a deep through-and-through dye -- so the preview must not show a heavily
  // saturated block, or the delivered piece looks much paler than what the customer approved.
  const isTint = TINT_COLORS.has(magicColor);
  const interiorPhrase =
    magicColor === "furCavity"
      ? "The whole figure is carved from clear, colorless glass-like crystal, and the " +
        "inside is left completely empty and hollow, ready for the owner to add their " +
        "own keepsake later."
      : isTint
        ? `The entire figure -- ${wholeSubjectPhrase} -- is molded from clear, glass-like resin ` +
          `that carries a LIGHT, delicate tint: ${colorPhrase}. The color is a soft, pale wash ` +
          "(never a deep, dark or heavily saturated dye), and the piece stays mostly see-through."
        : `The entire figure -- ${wholeSubjectPhrase} -- is carved from ` +
          `ONE single uniform block of resin: ${colorPhrase} runs evenly through the whole piece, ` +
          "not just filling a cavity inside a clear outer shell.";
  const swatchPhrase = colorHints?.swatch
    ? "The LAST attached image is a photo of the REAL finished material for this color -- match " +
      "its exact color, color depth, translucency and surface finish as closely as possible, but " +
      "take NOTHING else from it (not its shape, subject or background). "
    : "";
  // Found by running 20 real photos through the pipeline: this template used to ALWAYS demand
  // "sparkling glitter suspended inside", directly contradicting the plain colors' own phrases
  // ("no glitter") -- so the launch lineup's clear/black/white came back glittery. Also, a note like
  // "wearing a red outfit" tinted the whole figure red, and a dog photo once came back blue; the
  // material color is now stated as the ONLY color, accessories included.
  const hasGlitter = !NO_GLITTER_COLORS.has(magicColor) && magicColor !== "furCavity";
  const materialPhrase = hasGlitter
    ? "solid, three-dimensional colored glass with tiny sparkling glitter suspended inside"
    : "solid, three-dimensional smooth resin with a clean, uniform finish and absolutely no glitter or sparkle particles";
  const prompt =
    `A highly detailed, photorealistic macro photography of a figurine keychain depicting ` +
    `${subjectPhrase(subject, subjectType)}, in ${posePhrase(pose, subjectType)}. ${shapeStylePhrase}${interiorPhrase} Do not depict the subject's ` +
    `${realColoringPhrase} anywhere -- only the overall shape ` +
    "and silhouette should be recognizable; the material itself must read as " +
    `${materialPhrase}, never a flat illustration and ${neverRealisticPhrase}. ` +
    "The material color above is the ONLY color on the whole figure: any accessory, clothing, or " +
    "marking mentioned in the notes below is sculpted from this same single material and color, " +
    "never colored differently. " +
    "Do not show any cork, wooden base, keychain hardware, or other object -- just " +
    "the bare crystal figurine by itself. Cinematic lighting, centered composition, " +
    "no text or watermark. " +
    swatchPhrase +
    `Use the attached ${colorHints?.swatch ? "subject " : ""}reference photos only to match the ` +
    "subject's shape, pose, and identity, not its real coloring." +
    (wantsSelfStanding ? STABILITY_PHRASE : "") +
    petDetailsPhrase(petDetails, subjectType);

  return generateImage(
    client,
    colorHints?.swatch ? [...referencePhotos, colorHints.swatch] : referencePhotos,
    prompt
  );
}

