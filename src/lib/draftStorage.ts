// Thin wrapper around the browser's raw IndexedDB API for persisting the in-progress order draft
// across page navigation/reloads -- unlike localStorage, IndexedDB can store File objects
// directly (structured clone), which the draft's uploaded photos need. One DB, one object store,
// one record per named "slice" (orderDraft, previewDraft, duoDraft, poseSetDraft) so each
// component owns and clears just its own piece.
const DB_NAME = "lumina-charo-draft";
const STORE_NAME = "slices";
const DB_VERSION = 1;

function isSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("charo-draft-changed"));
}

export async function saveDraftSlice<T>(key: string, value: T): Promise<void> {
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyChanged();
  } catch (error) {
    // Best-effort only -- a full/blocked IndexedDB (private browsing, quota) shouldn't break the
    // order form itself, just fall back to no persistence.
    console.error(`saveDraftSlice(${key}) failed`, error);
  }
}

export async function loadDraftSlice<T>(key: string): Promise<T | undefined> {
  if (!isSupported()) return undefined;
  try {
    const db = await openDb();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (error) {
    console.error(`loadDraftSlice(${key}) failed`, error);
    return undefined;
  }
}

export async function clearDraftSlice(key: string): Promise<void> {
  if (!isSupported()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyChanged();
  } catch (error) {
    console.error(`clearDraftSlice(${key}) failed`, error);
  }
}

// Every slice key any component saves under -- kept in one place so resetDraftBuilder (and the
// post-checkout cleanup) can clear all of them without each caller needing to know every other
// component's key.
export const DRAFT_SLICE_KEYS = [
  "orderDraft",
  "previewDraft",
  "duoDraft",
  "poseSetDraft",
] as const;

export async function clearAllDraftSlices(): Promise<void> {
  await Promise.all(DRAFT_SLICE_KEYS.map((key) => clearDraftSlice(key)));
}
