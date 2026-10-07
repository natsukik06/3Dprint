// Wraps one of the shop's own Firebase Storage image URLs in the Next image optimizer (resized and
// converted to WebP -- a 350KB PNG becomes a few KB). Anything else is returned unchanged, so it is safe to
// call on any src. `width` should be a bit larger than the size it is shown at (it must be one of Next's
// configured sizes: 16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080 ...).
const OWN_STORAGE_PREFIX = "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/";

export function optimizedImageUrl(url: string, width = 640): string {
  if (!url.startsWith(OWN_STORAGE_PREFIX)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
