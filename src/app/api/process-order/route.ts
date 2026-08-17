import { NextResponse, type NextRequest } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { computeBoundingBoxMm, determineTargetMaxMm, scaleGlb } from "@/lib/modelScaling";
import { SHIPPING_METHOD_BY_SIZE, type BoundingBoxMm, type SizeOption } from "@/types/order";

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

export async function POST(request: NextRequest) {
  let orderId: string | undefined;
  try {
    const body = await request.json();
    orderId = body?.orderId;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ error: "orderIdが必要です" }, { status: 400 });
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
    }

    const order = snap.data() as {
      modelUrl: string | null;
      sizeOption: SizeOption;
      scaledModelUrl: string | null;
    };

    if (order.scaledModelUrl) {
      return NextResponse.json({ status: "already_processed" });
    }
    if (!order.modelUrl) {
      return NextResponse.json(
        { error: "3Dモデルが未生成のため処理できません" },
        { status: 400 }
      );
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

    return NextResponse.json({
      status: "processed",
      scaledModelUrl,
      shippingMethod,
      maxDimensionMm,
    });
  } catch (error) {
    console.error("process-order failed", error);
    return NextResponse.json({ error: "注文処理に失敗しました" }, { status: 502 });
  }
}
