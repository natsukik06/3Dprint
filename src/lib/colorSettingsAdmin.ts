import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  mergeColorSettings,
  type ColorSetting,
  type ColorSettingPatch,
  type ColorSettingsMap,
  type PriceYenBySize,
} from "@/lib/colorSettings";
import { MAGIC_COLOR_OPTIONS, SIZE_OPTIONS, type MagicColor } from "@/types/order";

const SETTINGS_DOC = adminDb.collection("config").doc("colorOptions");

export async function getColorSettings(): Promise<ColorSettingsMap> {
  const snap = await SETTINGS_DOC.get();
  return mergeColorSettings(
    snap.data() as
      | Partial<
          Record<
            MagicColor,
            Partial<Omit<ColorSetting, "priceYenBySize">> & {
              priceYenBySize?: Partial<PriceYenBySize>;
            }
          >
        >
      | undefined
  );
}

export async function saveColorSettings(
  updates: Partial<Record<MagicColor, ColorSettingPatch>>
): Promise<void> {
  // Only include a field in the write when the caller actually means to set it -- Firestore's
  // own set(..., {merge: true}) merges nested maps recursively (not just top-level fields), so an
  // omitted key here (e.g. leaving `enabled` out of a price-only edit) simply leaves whatever's
  // already stored for that field untouched, no need to pre-fetch and re-supply the rest.
  const sanitized: Partial<Record<MagicColor, Partial<ColorSetting>>> = {};
  for (const color of MAGIC_COLOR_OPTIONS) {
    const update = updates[color];
    if (!update) continue;
    const entry: Partial<ColorSetting> = {};
    if (typeof update.enabled === "boolean") {
      entry.enabled = update.enabled;
    }
    if (update.priceYenBySize) {
      const prices: Partial<PriceYenBySize> = {};
      for (const size of SIZE_OPTIONS) {
        const raw = update.priceYenBySize[size];
        if (typeof raw === "number" && Number.isFinite(raw)) {
          prices[size] = Math.max(0, Math.round(raw));
        }
      }
      if (Object.keys(prices).length > 0) {
        entry.priceYenBySize = prices as PriceYenBySize;
      }
    }
    if (typeof update.label === "string" && update.label.trim()) {
      entry.label = update.label.trim();
    }
    if (typeof update.imageUrl === "string" && update.imageUrl.trim()) {
      entry.imageUrl = update.imageUrl.trim();
    }
    if (typeof update.previewPrompt === "string") {
      // An empty value means "back to the built-in description" -- an actual field delete, since
      // merge:true would otherwise leave the old text in place.
      (entry as Record<string, unknown>).previewPrompt = update.previewPrompt.trim()
        ? update.previewPrompt.trim().slice(0, 600)
        : FieldValue.delete();
    }
    if (Object.keys(entry).length > 0) {
      sanitized[color] = entry;
    }
  }
  if (Object.keys(sanitized).length > 0) {
    await SETTINGS_DOC.set(sanitized, { merge: true });
  }
}
