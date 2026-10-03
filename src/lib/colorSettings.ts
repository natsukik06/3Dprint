import { MAGIC_COLOR_OPTIONS, SIZE_OPTIONS, type MagicColor, type SizeOption } from "@/types/order";

export type PriceYenBySize = Record<SizeOption, number>;

export type ColorSetting = {
  enabled: boolean;
  // Per-size add-on -- a color can cost more on a bigger piece than a smaller one, so this isn't
  // one flat number (see /admin/colors).
  priceYenBySize: PriceYenBySize;
  // Admin-editable overrides for the code-level MAGIC_COLOR_LABELS / swatch photo (see
  // /admin/colors) -- unset (undefined) means "use the code default", not "blank".
  label?: string;
  imageUrl?: string;
  // Extra control over the AI 完成イメージ for this color (see generateFinishedPreview): a
  // replacement for the built-in English material description (e.g. "a pale, delicate pink tint
  // on clear resin"). Unset = the built-in description. The color's swatch photo (imageUrl) is
  // ALSO sent to the AI as the real-material reference whenever one exists.
  previewPrompt?: string;
};
export type ColorSettingsMap = Record<MagicColor, ColorSetting>;

// The shape of a partial edit to one color -- used by the admin page's per-field inputs (each
// blur/upload only ever touches one field) and by the admin API route/colorSettingsAdmin.ts on
// the way to Firestore. priceYenBySize here is intentionally a Partial -- editing one size's
// price shouldn't require resending every other size.
export type ColorSettingPatch = Partial<{
  enabled: boolean;
  priceYenBySize: Partial<PriceYenBySize>;
  label: string;
  imageUrl: string;
  // Empty string clears it back to the built-in description.
  previewPrompt: string;
}>;

function zeroPriceBySize(): PriceYenBySize {
  return Object.fromEntries(SIZE_OPTIONS.map((size) => [size, 0])) as PriceYenBySize;
}

// Launch lineup (2026-09) -- just the 3 plain colors, per the shop owner's call to simplify the
// storefront. Everything else stays fully wired up (pricing, AI prompt phrases, the picker UI)
// but hidden until re-enabled from /admin/colors -- no code change needed to bring a color back.
// furCavity is a structural option (毛入れ用/思い出の品入れ用), not a decorative color choice, so
// it's excluded from this "launch simplification" and stays on by default.
const DEFAULT_ENABLED: Partial<Record<MagicColor, boolean>> = {
  pureClear: true,
  smokeOnyx: true, // sold as クリアブラック
  clearBlue: true,
  clearRed: true,
  clearYellow: true,
  clearGreen: true, // blend of blue + yellow -- color develops acceptably
  clearOrange: true, // blend of red + yellow -- color develops acceptably
  frosted: true, // uncoated, cloudy frosted-glass finish
  // clearPurple stays off: the blend doesn't develop a good color yet. clearPink is a ready,
  // photographed color but not switched on by default -- enable it from /admin/colors.
  // furCavity (毛入れ用) is not sold for now -- see AVAILABLE_SIZE_OPTIONS in types/order.ts.
};

export function defaultColorSettings(): ColorSettingsMap {
  return Object.fromEntries(
    MAGIC_COLOR_OPTIONS.map((color) => [
      color,
      { enabled: DEFAULT_ENABLED[color] ?? false, priceYenBySize: zeroPriceBySize() },
    ])
  ) as ColorSettingsMap;
}

// Overlays whatever's actually saved (Firestore, or a freshly-fetched API response -- possibly
// missing colors/sizes added after the doc was last written) onto the code-level defaults above,
// so a brand-new color or size always shows up with a sane fallback instead of `undefined`.
export function mergeColorSettings(
  saved:
    | Partial<Record<MagicColor, Partial<Omit<ColorSetting, "priceYenBySize">> & { priceYenBySize?: Partial<PriceYenBySize> }>>
    | undefined
    | null
): ColorSettingsMap {
  const merged = defaultColorSettings();
  if (!saved) return merged;
  for (const color of MAGIC_COLOR_OPTIONS) {
    const overrides = saved[color];
    if (!overrides) continue;
    merged[color] = {
      enabled: overrides.enabled ?? merged[color].enabled,
      priceYenBySize: {
        ...merged[color].priceYenBySize,
        ...overrides.priceYenBySize,
      },
      label: overrides.label || undefined,
      imageUrl: overrides.imageUrl || undefined,
      previewPrompt: overrides.previewPrompt || undefined,
    };
  }
  return merged;
}

// SpecOptions/admin-colors read through these instead of the code-level MAGIC_COLOR_LABELS /
// swatch-path records directly, so an admin override (once set) takes over without a code change.
export function colorLabel(
  settings: ColorSettingsMap,
  color: MagicColor,
  fallback: string
): string {
  return settings[color].label || fallback;
}

export function colorImageSrc(
  settings: ColorSettingsMap,
  color: MagicColor,
  fallback: string | null
): string | null {
  return settings[color].imageUrl || fallback;
}

export function enabledColors(settings: ColorSettingsMap): MagicColor[] {
  return MAGIC_COLOR_OPTIONS.filter((color) => settings[color].enabled);
}

// Feeds calculateEstimate's colorPriceYen option -- see src/lib/pricing.ts.
export function colorPriceBySizeMap(
  settings: ColorSettingsMap
): Record<MagicColor, PriceYenBySize> {
  return Object.fromEntries(
    MAGIC_COLOR_OPTIONS.map((color) => [color, settings[color].priceYenBySize])
  ) as Record<MagicColor, PriceYenBySize>;
}
