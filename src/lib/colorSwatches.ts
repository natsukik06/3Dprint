import type { MagicColor } from "@/types/order";

// Code-level fallback swatch photos, used whenever a color has no admin-uploaded override (see
// ColorSetting.imageUrl in colorSettings.ts) -- shared by the customer-facing picker
// (SpecOptions.tsx) and the admin editor (/admin/colors) so both show the same "what you'll see
// if you don't upload anything" image.
export const DEFAULT_COLOR_IMAGE_SRC: Record<MagicColor, string | null> = {
  starryBlue: "/colors/starryBlue.jpg",
  nebulaPink: "/colors/nebulaPink.jpg",
  clearAurora: "/colors/clearAurora.jpg",
  galaxyGreen: "/colors/galaxyGreen.jpg",
  cometOrange: "/colors/cometOrange.jpg",
  cosmicPurple: "/colors/cosmicPurple.jpg",
  marsRed: "/colors/marsRed.jpg",
  furCavity: null,
  pureClear: "/colors/pureClear.jpg",
  smokeOnyx: null,
  stardustBlack: null,
  // No swatch photo yet -- shows a placeholder icon until real product photos are shot and
  // uploaded from /admin/colors.
  pureBlack: null,
  pureWhite: null,
  clearBlue: null,
  clearRed: null,
  clearYellow: null,
  clearPink: null,
  clearGreen: null,
  clearPurple: null,
  clearOrange: null,
  frosted: null,
};
