import { readFile } from "node:fs/promises";
import path from "node:path";
import { COMPOSITION_PRESETS, MAX_COMPOSITION_IMAGE_BYTES } from "@/lib/compositions";
import type { ImagePayload } from "@/lib/gemini";

export type CompositionResult =
  | { ok: true; payload: ImagePayload | undefined }
  | { ok: false; error: string };

/**
 * Reads the optional composition reference from the form: a customer-uploaded image
 * ("compositionImage") wins over a preset id ("compositionId"). Preset ids are checked against the
 * fixed allow-list and read from public/compositions -- no path or URL from the client is ever used.
 */
export async function readCompositionRef(formData: FormData): Promise<CompositionResult> {
  const upload = formData.get("compositionImage");
  if (upload instanceof File && upload.size > 0) {
    if (!upload.type.startsWith("image/")) {
      return { ok: false, error: "構図の画像は画像ファイルを選んでください" };
    }
    if (upload.size > MAX_COMPOSITION_IMAGE_BYTES) {
      return { ok: false, error: "構図の画像が大きすぎます（8MBまで）" };
    }
    const buffer = Buffer.from(await upload.arrayBuffer());
    return { ok: true, payload: { data: buffer.toString("base64"), mimeType: upload.type } };
  }

  const id = formData.get("compositionId");
  if (typeof id === "string" && id) {
    const preset = COMPOSITION_PRESETS.find((c) => c.id === id);
    if (!preset) return { ok: false, error: "構図の指定が正しくありません" };
    try {
      const file = path.join(process.cwd(), "public", "compositions", `${preset.id}.png`);
      const buffer = await readFile(file);
      return { ok: true, payload: { data: buffer.toString("base64"), mimeType: "image/png" } };
    } catch {
      // On Vercel, files under public/ are served from the CDN and are not always present in the
      // function's filesystem -- fetch the same fixed, allow-listed file from the shop's own site.
      try {
        const res = await fetch(`https://diy-figure-app.vercel.app/compositions/${preset.id}.png`);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          return { ok: true, payload: { data: buffer.toString("base64"), mimeType: "image/png" } };
        }
      } catch {
        // fall through
      }
      // Still unavailable: continue without a composition rather than failing the customer.
      return { ok: true, payload: undefined };
    }
  }
  return { ok: true, payload: undefined };
}
