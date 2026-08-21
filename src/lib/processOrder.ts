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

  await adminDb.collection("order_items").add({
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
    hasVentHole: false,
    ventHoleSource: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Scales each item's model to its size option's target dimension, fans them out into individual
 * `order_items` docs (one per physical piece to print), and assigns the whole order's shipping
 * method (the strictest method required by any item). Idempotent (skips if items already exist
 * for this order) -- shared by the admin "reprocess" API route and the post-payment webhook.
 */
export async function runOrderProcessing(orderId: string): Promise<ProcessOrderResult> {
  const orderRef = adminDb.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    throw new Error("注文が見つかりません");
  }

  const existing = await adminDb
    .collection("order_items")
    .where("orderId", "==", orderId)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { status: "already_processed" };
  }

  const order = snap.data() as {
    items: OrderItemDraft[];
    customerName: string;
  };
  if (!order.items || order.items.length === 0) {
    throw new Error("セットにアイテムがありません");
  }

  await Promise.all(
    order.items.map((item, index) =>
      scaleOneItem(orderId, index, item, order.customerName)
    )
  );

  const shippingMethod = determineShippingMethod(
    order.items.map((item) => ({ sizeOption: item.sizeOption }))
  );
  await orderRef.update({ shippingMethod });

  return { status: "processed", shippingMethod, itemCount: order.items.length };
}
