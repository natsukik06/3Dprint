import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { computeBoundingBoxMm, determineTargetMaxMm, scaleGlb } from "@/lib/modelScaling";
import {
  determineShippingMethod,
  type BoundingBoxMm,
  type OrderItemDraft,
} from "@/types/order";

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

export type ProcessOrderResult =
  | { status: "already_processed" }
  | { status: "processed"; shippingMethod: string; itemCount: number };

async function scaleOneItem(
  orderId: string,
  itemIndex: number,
  item: OrderItemDraft,
  customerName: string
) {
  const modelRes = await fetch(item.modelUrl);
  if (!modelRes.ok) {
    throw new Error(`Failed to download model: ${modelRes.status}`);
  }
  const originalBuffer = Buffer.from(await modelRes.arrayBuffer());

  const modelBoundingBoxMm: BoundingBoxMm = computeBoundingBoxMm(originalBuffer);
  const originalMaxDimension = Math.max(
    modelBoundingBoxMm.x,
    modelBoundingBoxMm.y,
    modelBoundingBoxMm.z
  );
  if (!(originalMaxDimension > 0)) {
    throw new Error("モデルのバウンディングボックスを計算できませんでした");
  }

  const targetMaxMm = determineTargetMaxMm(item.sizeOption);
  const factor = targetMaxMm / originalMaxDimension;
  const scaledBuffer = scaleGlb(originalBuffer, factor);
  const scaledBoundingBoxMm: BoundingBoxMm = {
    x: modelBoundingBoxMm.x * factor,
    y: modelBoundingBoxMm.y * factor,
    z: modelBoundingBoxMm.z * factor,
  };

  const bucket = adminStorage.bucket();
  const path = `models/${orderId}-${itemIndex}-scaled.glb`;
  await bucket.file(path).save(scaledBuffer, {
    contentType: "model/gltf-binary",
  });
  const scaledModelUrl = buildPublicUrl(bucket.name, path);
  const maxDimensionMm = Math.max(
    scaledBoundingBoxMm.x,
    scaledBoundingBoxMm.y,
    scaledBoundingBoxMm.z
  );

  // Deterministic id + create(): each item is registered exactly once even if two runs overlap, and
  // a retry after a partial failure only has to redo the items that are still missing.
  await adminDb.collection("order_items").doc(`${orderId}-${itemIndex}`).create({
    ...item,
    orderId,
    itemIndex,
    customerName,
    modelBoundingBoxMm,
    scaledModelUrl,
    scaledBoundingBoxMm,
    maxDimensionMm,
    status: "pending",
    batchId: null,
    gridId: null,
    finishedModelUrl: null,
    wallThicknessMm: null,
    sphereSegments: null,
    hasVentHole: false,
    ventHoleSource: null,
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error: { code?: number }) => {
    // ALREADY_EXISTS: a duplicate/overlapping delivery of the same payment event registered this
    // item first. That is exactly the outcome we want, so it is not a failure.
    if (error?.code !== 6) throw error;
  });
}

/**
 * Scales each item's model to its size option's target dimension, fans them out into individual
 * `order_items` docs (one per physical piece to print), and assigns the whole order's shipping
 * method (the strictest method required by any item). Safe to run again: items already registered
 * (by index) are skipped, so a run that failed halfway through -- e.g. the 2nd of 3 items -- is
 * completed by simply retrying, instead of being treated as done because ONE item exists. Shared by
 * the admin "reprocess" API route and the post-payment webhook.
 */
export async function runOrderProcessing(orderId: string): Promise<ProcessOrderResult> {
  const orderRef = adminDb.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    throw new Error("注文が見つかりません");
  }

  const order = snap.data() as {
    items: OrderItemDraft[];
    customerName: string;
  };
  if (!order.items || order.items.length === 0) {
    throw new Error("セットにアイテムがありません");
  }

  const existing = await adminDb.collection("order_items").where("orderId", "==", orderId).get();
  const doneIndexes = new Set<number>(existing.docs.map((d) => Number(d.data().itemIndex)));
  const missing = order.items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => !doneIndexes.has(index));
  if (missing.length === 0) {
    return { status: "already_processed" };
  }

  // allSettled (not all): one failing item must not abandon the others half-written -- finish what
  // can be finished, then report every failure so the order is flagged and a retry redoes only those.
  const results = await Promise.allSettled(
    missing.map(({ item, index }) => scaleOneItem(orderId, index, item, order.customerName))
  );
  const failures = results
    .map((r, i) => ({ r, index: missing[i].index }))
    .filter((x): x is { r: PromiseRejectedResult; index: number } => x.r.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      failures
        .map(({ r, index }) => `商品${index + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
        .join(" / ")
    );
  }

  const shippingMethod = determineShippingMethod(
    order.items.map((item) => ({ sizeOption: item.sizeOption }))
  );
  await orderRef.update({ shippingMethod });

  return { status: "processed", shippingMethod, itemCount: order.items.length };
}