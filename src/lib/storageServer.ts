import { adminStorage } from "@/lib/firebaseAdmin";

// Server-side Storage helpers. These use the Admin SDK (which bypasses Storage security rules), so
// the rules can stay closed to the public for orders/, models/ and previews/ -- previously these
// uploads went through the browser SDK from a signed-out server context, which forced those folders
// to be writable by anyone on the internet.

function publicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

async function saveFile(path: string, data: Buffer, contentType: string): Promise<string> {
  const bucket = adminStorage.bucket();
  await bucket.file(path).save(data, { contentType, resumable: false });
  return publicUrl(bucket.name, path);
}

async function existingUrl(path: string): Promise<string | null> {
  const bucket = adminStorage.bucket();
  const [exists] = await bucket.file(path).exists();
  return exists ? publicUrl(bucket.name, path) : null;
}

async function uploadReferencePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("image files only");
  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const path = `orders/${crypto.randomUUID()}.${extension}`;
  return saveFile(path, Buffer.from(await file.arrayBuffer()), file.type);
}

export async function uploadReferencePhotos(files: File[]): Promise<string[]> {
  return Promise.all(files.map(uploadReferencePhoto));
}

export async function getHostedModelUrl(taskId: string): Promise<string | null> {
  return existingUrl(`models/${taskId}.glb`);
}

export async function uploadGeneratedModel(buffer: Buffer, taskId: string): Promise<string> {
  return saveFile(`models/${taskId}.glb`, buffer, "model/gltf-binary");
}

// Tripo's own renderedImageUrl is a signed, expiring URL -- left as-is, a gallery thumbnail saved
// from it would silently break once the signature expires, so it's re-hosted like the model.
export async function getHostedRenderedImageUrl(taskId: string): Promise<string | null> {
  return existingUrl(`previews/rendered-${taskId}.webp`);
}

export async function uploadRenderedImage(
  buffer: Buffer,
  taskId: string,
  contentType: string
): Promise<string> {
  return saveFile(`previews/rendered-${taskId}.webp`, buffer, contentType);
}

export async function uploadFinishedPreview(buffer: Buffer, previewId: string): Promise<string> {
  return saveFile(`previews/${previewId}.png`, buffer, "image/png");
}
