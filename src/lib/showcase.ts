import type { DocumentData } from "firebase-admin/firestore";
import {
  HOME_SHOWCASE_LIMIT,
  type ShowcaseItemAdmin,
  type ShowcaseItemPublic,
} from "@/types/showcase";

// サーバー専用(firebase-admin)。クライアントから import しないこと。
export const SHOWCASE_COLLECTION = "showcase_items";

function tsToMs(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function toAdminItem(id: string, data: DocumentData): ShowcaseItemAdmin {
  return {
    id,
    orderId: String(data.orderId ?? ""),
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
    itemIndex: Number(data.itemIndex ?? 0),
    title: String(data.title ?? ""),
    caption: String(data.caption ?? ""),
    modelUrl: String(data.modelUrl ?? ""),
    customerImageUrl: typeof data.customerImageUrl === "string" ? data.customerImageUrl : null,
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : null,
    showOnHome: data.showOnHome === true,
    published: data.published === true,
    order: Number(data.order ?? 0),
    createdAtMs: tsToMs(data.createdAt),
    publishedAtMs: tsToMs(data.publishedAt),
  };
}

function toPublicItem(item: ShowcaseItemAdmin): ShowcaseItemPublic {
  return {
    id: item.id,
    title: item.title,
    caption: item.caption,
    modelUrl: item.modelUrl,
    customerImageUrl: item.customerImageUrl,
    photoUrl: item.photoUrl,
    showOnHome: item.showOnHome,
  };
}

// 公開済みの作成例(表示順 → 公開が新しい順)。取得に失敗したら空配列(=セクションを出さない)。
export async function getPublishedShowcase(options?: {
  homeOnly?: boolean;
}): Promise<ShowcaseItemPublic[]> {
  try {
    const { adminDb } = await import("@/lib/firebaseAdmin");
    const snap = await adminDb
      .collection(SHOWCASE_COLLECTION)
      .where("published", "==", true)
      .get();
    let items = snap.docs
      .map((d) => toAdminItem(d.id, d.data()))
      .filter((item) => item.modelUrl || item.photoUrl)
      .sort(
        (a, b) => a.order - b.order || (b.publishedAtMs ?? 0) - (a.publishedAtMs ?? 0)
      );
    if (options?.homeOnly) {
      items = items.filter((item) => item.showOnHome).slice(0, HOME_SHOWCASE_LIMIT);
    }
    return items.map(toPublicItem);
  } catch (error) {
    console.error("getPublishedShowcase failed", error);
    return [];
  }
}

// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media -> "<path>"
export function storagePathFromUrl(url: string, bucketName: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "firebasestorage.googleapis.com") return null;
    const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!m || m[1] !== bucketName) return null;
    const path = decodeURIComponent(m[2]);
    if (path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

export function storagePublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}
