import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { cutHoles, hollowMesh, type HoleSpec } from "@/lib/meshBoolean";
import { boundsOfTriangles, computeScaleFactor, extractWorldTriangles } from "@/lib/modelScaling";
import { trianglesToStl } from "@/lib/stl";
import {
  DEFAULT_DRAIN_HOLE_DIAMETER_MM,
  HARDWARE_HOLE_DIAMETER_MM,
  type BoundingBoxMm,
  type HolePoint,
} from "@/types/order";

const DEFAULT_WALL_THICKNESS_MM = 2;

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

function scalePoint(p: HolePoint, factor: number): [number, number, number] {
  return [p.x * factor, p.y * factor, p.z * factor];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: orderId } = await params;
  let wallThicknessMm = DEFAULT_WALL_THICKNESS_MM;
  try {
    const body = await request.json();
    if (typeof body?.wallThicknessMm === "number" && body.wallThicknessMm > 0) {
      wallThicknessMm = body.wallThicknessMm;
    }
  } catch {
    // no body / invalid JSON — use default wall thickness
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
    }
    const order = snap.data() as {
      modelUrl: string | null;
      scaledModelUrl: string | null;
      modelBoundingBoxMm: BoundingBoxMm | null;
      scaledBoundingBoxMm: BoundingBoxMm | null;
      wantsHardware: boolean;
      holePosition: HolePoint | null;
      bottomHolePosition: HolePoint | null;
      bottomHoleDiameterMm: number | null;
    };

    const sourceUrl = order.scaledModelUrl ?? order.modelUrl;
    if (!sourceUrl) {
      return NextResponse.json({ error: "3Dモデルが未生成のため処理できません" }, { status: 400 });
    }
    const usingScaledModel = Boolean(order.scaledModelUrl);
    const scaleFactor =
      usingScaledModel && order.modelBoundingBoxMm && order.scaledBoundingBoxMm
        ? computeScaleFactor(order.modelBoundingBoxMm, order.scaledBoundingBoxMm)
        : 1;

    const modelRes = await fetch(sourceUrl);
    if (!modelRes.ok) throw new Error(`モデルのダウンロードに失敗しました: ${modelRes.status}`);
    const buffer = Buffer.from(await modelRes.arrayBuffer());
    const originalTriangles = extractWorldTriangles(buffer);

    const hollowed = await hollowMesh(originalTriangles, wallThicknessMm);

    const holes: HoleSpec[] = [];
    if (order.wantsHardware && order.holePosition) {
      holes.push({
        position: scalePoint(order.holePosition, scaleFactor),
        diameterMm: HARDWARE_HOLE_DIAMETER_MM,
        axis: "y",
      });
    }
    if (order.bottomHolePosition && order.bottomHoleDiameterMm) {
      holes.push({
        position: scalePoint(order.bottomHolePosition, scaleFactor),
        diameterMm: order.bottomHoleDiameterMm,
        axis: "y",
      });
    }
    const ventHoleSource: "auto" | "customer" = holes.length > 0 ? "customer" : "auto";

    // The hollowed cavity must never end up sealed: if the customer didn't
    // request a hardware/cork hole, drill a small drain hole straight up
    // through the model's bottom-center so it always vents automatically.
    const { min: hollowedMin, max: hollowedMax } = boundsOfTriangles(hollowed);
    if (holes.length === 0) {
      holes.push({
        position: [
          (hollowedMin[0] + hollowedMax[0]) / 2,
          hollowedMin[1],
          (hollowedMin[2] + hollowedMax[2]) / 2,
        ],
        diameterMm: DEFAULT_DRAIN_HOLE_DIAMETER_MM,
        axis: "y",
      });
    }

    const maxDim = Math.max(
      hollowedMax[0] - hollowedMin[0],
      hollowedMax[1] - hollowedMin[1],
      hollowedMax[2] - hollowedMin[2]
    );
    const finalTriangles = await cutHoles(hollowed, holes, maxDim * 2);

    const stl = trianglesToStl(finalTriangles);
    const bucket = adminStorage.bucket();
    const path = `models/${orderId}-finished.stl`;
    await bucket.file(path).save(stl, { contentType: "model/stl" });
    const finishedModelUrl = buildPublicUrl(bucket.name, path);

    await orderRef.update({
      finishedModelUrl,
      wallThicknessMm,
      hasVentHole: true,
      ventHoleSource,
    });

    return NextResponse.json({
      finishedModelUrl,
      wallThicknessMm,
      holesCut: holes.length,
      hasVentHole: true,
      ventHoleSource,
    });
  } catch (error) {
    console.error("finish-mesh failed", error);
    const message = error instanceof Error ? error.message : "処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
