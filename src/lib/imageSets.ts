import { FieldValue } from "firebase-admin/firestore";
import sharp from "sharp";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import type { ImagePayload, ShapeRiskAssessment } from "@/lib/gemini";
import type { ModelStyle } from "@/types/order";

// 作った画像セット (the 4-view images, the 2-pet 4-view images, or the 5 pose images) saved to the
// customer's ACCOUNT the moment they are generated, so paying, reloading, switching device or coming
// back tomorrow never loses them -- and they can be used later without spending another generation.
//
// Layout: images in Storage at imagesets/<uid>/<setId>/<key>.jpg (written by the server with the Admin
// SDK, no public rule), metadata + tiny thumbnails in Firestore users/<uid>/image_sets/<setId> (no client
// rule either: everything goes through /api/image-sets, which checks the signed-in user).
export type ImageSetKind = "single" | "duo" | "poseset";

export type ImageSetSummary = {
  id: string;
  kind: ImageSetKind;
  style: ModelStyle | null;
  subject: string;
  createdAtMs: number;
  thumbs: string[]; // data URLs, ~160px
};

export type ImageSetFull = Omit<ImageSetSummary, "thumbs"> & {
  referenceImageUrls: string[];
  riskAssessment: ShapeRiskAssessment | null;
  images: Record<string, ImagePayload>;
};

// Older sets beyond this many per customer are deleted when a new one is saved.
export const MAX_SAVED_IMAGE_SETS = 12;

const sets = (uid: string) => adminDb.collection("users").doc(uid).collection("image_sets");
const folder = (uid: string, id: string) => `imagesets/${uid}/${id}/`;

async function toJpegBuffer(image: ImagePayload): Promise<Buffer> {
  return sharp(Buffer.from(image.data, "base64")).jpeg({ quality: 88 }).toBuffer();
}

/** Saves a generated set. Never throws: a failed save must not fail the generation the customer paid for. */
export async function saveImageSet(
  uid: string,
  input: {
    kind: ImageSetKind;
    style?: ModelStyle;
    subject: string;
    images: Record<string, ImagePayload>;
    referenceImageUrls: string[];
    riskAssessment?: ShapeRiskAssessment | null;
  }
): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const keys = Object.keys(input.images);
    const bucket = adminStorage.bucket();
    const buffers = await Promise.all(keys.map((key) => toJpegBuffer(input.images[key])));
    await Promise.all(
      keys.map((key, i) =>
        bucket.file(`${folder(uid, id)}${key}.jpg`).save(buffers[i], {
          contentType: "image/jpeg",
          resumable: false,
        })
      )
    );
    const thumbs = await Promise.all(
      buffers.slice(0, 4).map(async (buffer) => {
        const small = await sharp(buffer).resize(160, 160, { fit: "contain", background: "#ffffff" }).jpeg({ quality: 70 }).toBuffer();
        return `data:image/jpeg;base64,${small.toString("base64")}`;
      })
    );
    await sets(uid).doc(id).set({
      kind: input.kind,
      style: input.style ?? null,
      subject: input.subject.slice(0, 80),
      keys,
      thumbs,
      referenceImageUrls: input.referenceImageUrls,
      riskAssessment: input.riskAssessment ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    await pruneImageSets(uid);
    return id;
  } catch (error) {
    console.error("saveImageSet failed", error);
    return null;
  }
}

async function pruneImageSets(uid: string): Promise<void> {
  const old = await sets(uid).orderBy("createdAt", "desc").offset(MAX_SAVED_IMAGE_SETS).get();
  for (const doc of old.docs) await deleteImageSet(uid, doc.id);
}

export async function listImageSets(uid: string, kind?: ImageSetKind): Promise<ImageSetSummary[]> {
  const snap = await sets(uid).orderBy("createdAt", "desc").limit(MAX_SAVED_IMAGE_SETS).get();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        kind: d.kind as ImageSetKind,
        style: (d.style as ModelStyle | null) ?? null,
        subject: (d.subject as string) ?? "",
        createdAtMs: d.createdAt?.toMillis?.() ?? 0,
        thumbs: (d.thumbs as string[]) ?? [],
      };
    })
    .filter((s) => !kind || s.kind === kind);
}

export async function getImageSet(uid: string, id: string): Promise<ImageSetFull | null> {
  const snap = await sets(uid).doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const keys = (d.keys as string[]) ?? [];
  const bucket = adminStorage.bucket();
  const images: Record<string, ImagePayload> = {};
  await Promise.all(
    keys.map(async (key) => {
      const [buffer] = await bucket.file(`${folder(uid, id)}${key}.jpg`).download();
      images[key] = { data: buffer.toString("base64"), mimeType: "image/jpeg" };
    })
  );
  return {
    id,
    kind: d.kind as ImageSetKind,
    style: (d.style as ModelStyle | null) ?? null,
    subject: (d.subject as string) ?? "",
    createdAtMs: d.createdAt?.toMillis?.() ?? 0,
    referenceImageUrls: (d.referenceImageUrls as string[]) ?? [],
    riskAssessment: (d.riskAssessment as ShapeRiskAssessment | null) ?? null,
    images,
  };
}

export async function deleteImageSet(uid: string, id: string): Promise<void> {
  await adminStorage.bucket().deleteFiles({ prefix: folder(uid, id) }).catch((error) =>
    console.error("deleteImageSet files failed", error)
  );
  await sets(uid).doc(id).delete();
}
