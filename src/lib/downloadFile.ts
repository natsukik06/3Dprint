// Firebase Storage URLs are cross-origin, so a plain <a download="name.glb"> is silently ignored
// by the browser (the download attribute's filename only applies same-origin) -- it falls back
// to the last path segment of the URL, which is an opaque id, not anything a customer/admin can
// tell apart later. Fetching the file and downloading the resulting blob (same-origin blob: URL)
// is the one reliable way to force a real, human-readable filename regardless of where the file
// is actually hosted.
export async function downloadFileAs(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

// Strips characters that are unsafe/reserved in Windows+macOS filenames, so a subject like
// "たれ耳のうさぎ/かわいい" doesn't produce a broken or unexpectedly-nested download path.
export function sanitizeFilenamePart(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "_").trim() || "model";
}
