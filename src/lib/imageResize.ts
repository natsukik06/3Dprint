// Phone photos are routinely 4-12MB, but the shop's API routes sit behind a ~4.5MB request-body
// limit (Vercel functions), and up to 5 photos travel in one request. A photo that's too big used
// to fail deep inside the generation step with a raw error. Shrinking at selection time keeps every
// downstream step (previews, 3D generation, duo/pose-set) well under the limit -- and 1600px on the
// long edge is plenty of detail for the AI to work from.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.88;
// Already small -- leave untouched (also keeps tiny PNG/WebP files byte-for-byte as uploaded).
const SKIP_BELOW_BYTES = 600 * 1024;

export async function downscaleImage(file: File): Promise<File> {
  if (file.size < SKIP_BELOW_BYTES) return file;
  try {
    // from-image applies the EXIF orientation, so portrait phone photos don't come out sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no transparency -- paint white first so a transparent PNG doesn't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    // Only swap it in if it actually got smaller; otherwise the original is the better file.
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch (error) {
    console.error("downscaleImage failed; using the original file", error);
    return file;
  }
}
