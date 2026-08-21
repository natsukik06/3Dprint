import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { computeBoundingBoxMm, determineTargetMaxMm, scaleGlb } from "@/lib/modelScaling";
import { SHIPPING_METHOD_BY_SIZE, type BoundingBoxMm, type SizeOption } from "@/types/order";

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

export type ProcessOrderResult =
  | { status: "already_processed" }
  | { status: "processed"; scaledModelUrl: string; shippingMethod: string; maxDimensionMm: number };

/**
 * Auto-scales an order's model to its size option's target dimension and
 * assigns the matching shipping method. Idempotent (skips if already run).
 * Shared by the admin "reprocess" API route and the post-payment webhook.
 */
export async function runOrderProcessing(orderId: string): Promise<ProcessOrderResult> {
  const orderRef = adminDb.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    throw new Error("注文が見つかりません");
  }

  const order = snap.data() as {
    modelUrl: string | null;
    sizeOption: SizeOption;
    scaledModelUrl: string | null;
  };

  if (order.scaledModelUrl) {
    return { status: "already_processed" };
  }
  if (!order.modelUrl) {
    throw new Error("3Dモデルが未生成のため処理できません");
  }

  const modelRes = await fetch(order.modelUrl);
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

  const targetMaxMm = determineTargetMaxMm(order.sizeOption);
  const factor = targetMaxMm / originalMaxDimension;
  const scaledBuffer = scaleGlb(originalBuffer, factor);
  const scaledBoundingBoxMm: BoundingBoxMm = {
    x: modelBoundingBoxMm.x * factor,
    y: modelBoundingBoxMm.y * factor,
    z: modelBoundingBoxMm.z * factor,
  };

  const bucket = adminStorage.bucket();
  const path = `models/${orderId}-scaled.glb`;
  await bucket.file(path).save(scaledBuffer, {
    contentType: "model/gltf-binary",
  });
  const scaledModelUrl = buildPublicUrl(bucket.name, path);

  const shippingMethod = SHIPPING_METHOD_BY_SIZE[order.sizeOption];
  const maxDimensionMm = Math.max(
    scaledBoundingBoxMm.x,
    scaledBoundingBoxMm.y,
    scaledBoundingBoxMm.z
  );

  await orderRef.update({
    modelBoundingBoxMm,
    scaledModelUrl,
    scaledBoundingBoxMm,
    maxDimensionMm,
    shippingMethod,
  });

  return { status: "processed", scaledModelUrl, shippingMethod, maxDimensionMm };
}
