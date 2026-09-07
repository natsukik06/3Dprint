import admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { cutHoles, engraveText, hollowMesh, type HoleSpec } from "./lib/meshBoolean.js";
import {
  boundsOfTriangles,
  computeScaleFactor,
  extractWorldTriangles,
} from "./lib/modelScaling.js";
import { buildPlacedItemStl, packPlates, type StlPlacement } from "./lib/plateLayout.js";
import { stlToTriangles, trianglesToStl } from "./lib/stl.js";
import {
  DEFAULT_DRAIN_HOLE_DIAMETER_MM,
  HARDWARE_HOLE_DIAMETER_MM,
  type BoundingBoxMm,
  type HolePoint,
  type PrintBatchOrderEntry,
} from "./types.js";

admin.initializeApp();
const db = admin.firestore();

// Cloud Functions gets its own execution environment per invocation (up to 60 min / several GiB
// here), completely separate from the Next.js app's Vercel serverless functions -- this is the
// actual fix for the timeout risk flagged for finish-mesh/plate-layout, not just a bigger number.
const JOB_RUNTIME_OPTS = { timeoutSeconds: 540, memory: "2GiB" as const };

function buildPublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    path
  )}?alt=media`;
}

function scalePoint(p: HolePoint, factor: number): [number, number, number] {
  return [p.x * factor, p.y * factor, p.z * factor];
}

function holeDirection(p: HolePoint): [number, number, number] {
  if (typeof p.nx === "number" && typeof p.ny === "number" && typeof p.nz === "number") {
    return [p.nx, p.ny, p.nz];
  }
  return [0, 1, 0];
}

type JobDoc = {
  type: "finish-mesh" | "plate-layout";
  params: Record<string, unknown>;
};

async function updateProgress(
  jobRef: FirebaseFirestore.DocumentReference,
  progress: number,
  message: string
) {
  await jobRef.update({ progress, message, updatedAt: FieldValue.serverTimestamp() });
}

async function runFinishMeshJob(
  jobRef: FirebaseFirestore.DocumentReference,
  params: {
    itemId: string;
    wallThicknessMm: number;
    sphereSegments: number;
    // Where the drain hole sits on the model's bottom face, as 0-1 fractions across its
    // footprint (0.5, 0.5 = centered) -- set from the admin UI per item, since the ideal spot
    // (avoiding a visible face, a support point, etc.) differs per model. Computed against the
    // ORIGINAL (unscaled) model's bounds, matching how holePosition/bottomHolePosition below are
    // also stored in original-model space and later scaled by `scaleFactor`.
    bottomHoleXFraction?: number;
    bottomHoleZFraction?: number;
    bottomHoleDiameterMm?: number;
  }
) {
  const { itemId, wallThicknessMm, sphereSegments, bottomHoleXFraction, bottomHoleZFraction, bottomHoleDiameterMm } = params;
  const itemRef = db.collection("order_items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) throw new Error("アイテムが見つかりません");

  const item = snap.data() as {
    modelUrl: string | null;
    scaledModelUrl: string | null;
    modelBoundingBoxMm: BoundingBoxMm | null;
    scaledBoundingBoxMm: BoundingBoxMm | null;
    wantsHardware: boolean;
    holePosition: HolePoint | null;
    bottomHolePosition: HolePoint | null;
    bottomHoleDiameterMm: number | null;
    initial: string | null;
  };

  const sourceUrl = item.scaledModelUrl ?? item.modelUrl;
  if (!sourceUrl) throw new Error("3Dモデルが未生成のため処理できません");
  const usingScaledModel = Boolean(item.scaledModelUrl);
  const scaleFactor =
    usingScaledModel && item.modelBoundingBoxMm && item.scaledBoundingBoxMm
      ? computeScaleFactor(item.modelBoundingBoxMm, item.scaledBoundingBoxMm)
      : 1;

  await updateProgress(jobRef, 10, "モデルをダウンロード中...");
  const modelRes = await fetch(sourceUrl);
  if (!modelRes.ok) throw new Error(`モデルのダウンロードに失敗しました: ${modelRes.status}`);
  const buffer = Buffer.from(await modelRes.arrayBuffer());
  const originalTriangles = extractWorldTriangles(buffer);

  await updateProgress(jobRef, 30, "中空化しています（数分かかる場合があります）...");
  const hollowed = await hollowMesh(originalTriangles, wallThicknessMm, sphereSegments);

  await updateProgress(jobRef, 70, "穴あけ処理をしています...");
  const holes: HoleSpec[] = [];
  if (item.wantsHardware && item.holePosition) {
    holes.push({
      position: scalePoint(item.holePosition, scaleFactor),
      diameterMm: HARDWARE_HOLE_DIAMETER_MM,
      direction: holeDirection(item.holePosition),
    });
  }
  if (typeof bottomHoleXFraction === "number" && typeof bottomHoleZFraction === "number") {
    // Admin-specified position from the order page, as a fraction (0-1) of the ORIGINAL
    // (unscaled) model's own footprint -- computed here rather than trusting a stored absolute
    // position, so it stays correct regardless of the model's actual size.
    const { min: origMin, max: origMax } = boundsOfTriangles(originalTriangles);
    const point: HolePoint = {
      x: origMin[0] + (origMax[0] - origMin[0]) * bottomHoleXFraction,
      y: origMin[1],
      z: origMin[2] + (origMax[2] - origMin[2]) * bottomHoleZFraction,
    };
    holes.push({
      position: scalePoint(point, scaleFactor),
      diameterMm: bottomHoleDiameterMm ?? DEFAULT_DRAIN_HOLE_DIAMETER_MM,
      direction: [0, 1, 0],
    });
  } else if (item.bottomHolePosition && item.bottomHoleDiameterMm) {
    holes.push({
      position: scalePoint(item.bottomHolePosition, scaleFactor),
      diameterMm: item.bottomHoleDiameterMm,
      direction: holeDirection(item.bottomHolePosition),
    });
  }
  const ventHoleSource: "auto" | "customer" = holes.length > 0 ? "customer" : "auto";

  const { min: hollowedMin, max: hollowedMax } = boundsOfTriangles(hollowed);
  if (holes.length === 0) {
    holes.push({
      position: [
        (hollowedMin[0] + hollowedMax[0]) / 2,
        hollowedMin[1],
        (hollowedMin[2] + hollowedMax[2]) / 2,
      ],
      diameterMm: DEFAULT_DRAIN_HOLE_DIAMETER_MM,
      direction: [0, 1, 0],
    });
  }

  const maxDim = Math.max(
    hollowedMax[0] - hollowedMin[0],
    hollowedMax[1] - hollowedMin[1],
    hollowedMax[2] - hollowedMin[2]
  );
  let finalTriangles = await cutHoles(hollowed, holes, maxDim * 2);

  // Engrave the customer's chosen initial (INITIAL_OPTIONS in src/types/order.ts) into the
  // bottom face, offset from center (away from where the drain hole usually sits, default
  // fraction 0.5) so a physical piece can be identified even after it's off the shared print
  // plate, mixed in with others, and still colorless (see the batch work-sheet's own "刻印" label
  // for the paper-side half of this same cross-check). Uses hollowedMin/hollowedMax (already in
  // the final, scaled coordinate space `finalTriangles` is in) rather than the origMin/origMax +
  // scaleFactor route above -- that route only exists to translate a customer-specified position
  // captured in an earlier, different coordinate space; this one is always computed fresh, here.
  if (item.initial) {
    await updateProgress(jobRef, 85, "イニシャルを刻印しています...");
    const engraveXFraction = 0.2;
    const engraveZFraction = 0.2;
    const engravePosition: [number, number, number] = [
      hollowedMin[0] + (hollowedMax[0] - hollowedMin[0]) * engraveXFraction,
      hollowedMin[1],
      hollowedMin[2] + (hollowedMax[2] - hollowedMin[2]) * engraveZFraction,
    ];
    const engraveHeightMm = Math.min(2.5, (hollowedMax[0] - hollowedMin[0]) * 0.3);
    const engraveDepthMm = Math.min(0.4, wallThicknessMm * 0.5);
    finalTriangles = await engraveText(
      finalTriangles,
      item.initial,
      engravePosition,
      [0, -1, 0],
      engraveHeightMm,
      engraveDepthMm
    );
  }

  await updateProgress(jobRef, 90, "STLを保存中...");
  const stl = trianglesToStl(finalTriangles);
  const bucket = admin.storage().bucket();
  const path = `models/${itemId}-finished.stl`;
  await bucket.file(path).save(stl, { contentType: "model/stl" });
  const finishedModelUrl = buildPublicUrl(bucket.name, path);

  await itemRef.update({
    finishedModelUrl,
    wallThicknessMm,
    sphereSegments,
    hasVentHole: true,
    ventHoleSource,
  });

  return { finishedModelUrl, wallThicknessMm, sphereSegments, holesCut: holes.length, ventHoleSource };
}

async function runPlateLayoutJob(
  jobRef: FirebaseFirestore.DocumentReference,
  params: { batchId: string }
) {
  const { batchId } = params;
  const batchSnap = await db.collection("print_batches").doc(batchId).get();
  if (!batchSnap.exists) throw new Error("バッチが見つかりません");
  const entries = (batchSnap.data()?.entries ?? []) as PrintBatchOrderEntry[];
  if (entries.length === 0) throw new Error("バッチに注文がありません");

  const items: {
    id: string;
    triangles: Float32Array;
    worldMin: [number, number, number];
    footprintX: number;
    footprintZ: number;
  }[] = [];

  // A design ordered in quantity > 1 appears as several entries sharing one itemId (one grid
  // cell per physical copy) -- it's hollowed/holed once, so fetch+parse its STL once too, and
  // reuse that same geometry for every duplicate cell's placement below.
  const modelDataByItemId = new Map<
    string,
    { triangles: Float32Array; worldMin: [number, number, number]; footprintX: number; footprintZ: number }
  >();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    await updateProgress(
      jobRef,
      Math.round((i / entries.length) * 60),
      `モデルを取得中... (${i + 1}/${entries.length})`
    );

    let modelData = modelDataByItemId.get(entry.itemId);
    if (!modelData) {
      const itemSnap = await db.collection("order_items").doc(entry.itemId).get();
      // Require the hollowed+holed STL, not the raw scaledModelUrl (GLB) -- packing the
      // pre-hollowing model would ship solid, un-vented pieces straight to the printer. Run
      // "中空化・穴あけ処理を実行" on the order detail page for this item first.
      const finishedModelUrl = itemSnap.data()?.finishedModelUrl as string | undefined;
      if (!finishedModelUrl) {
        throw new Error(
          `アイテム ${entry.itemId}（${entry.gridId}）が中空化・穴あけ未処理です。先に注文詳細ページで処理してください`
        );
      }
      const modelRes = await fetch(finishedModelUrl);
      if (!modelRes.ok) throw new Error(`モデルのダウンロードに失敗しました: ${entry.orderId}`);
      const buffer = Buffer.from(await modelRes.arrayBuffer());
      const triangles = stlToTriangles(buffer);
      const { min, max } = boundsOfTriangles(triangles);
      modelData = {
        triangles,
        worldMin: min,
        footprintX: max[0] - min[0],
        footprintZ: max[2] - min[2],
      };
      modelDataByItemId.set(entry.itemId, modelData);
    }

    items.push({ id: entry.gridId, ...modelData });
  }

  await updateProgress(jobRef, 65, "プレートに配置を計算中...");
  const plates = packPlates(items.map(({ id, footprintX, footprintZ }) => ({ id, footprintX, footprintZ })));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const bucket = admin.storage().bucket();

  const results: { index: number; itemCount: number; items: { gridId: string; url: string }[] }[] = [];
  for (let plateIndex = 0; plateIndex < plates.length; plateIndex++) {
    const placedItems = plates[plateIndex];
    const placedFiles: { gridId: string; url: string }[] = [];
    for (const placed of placedItems) {
      const item = itemsById.get(placed.id);
      if (!item) throw new Error(`配置アイテムが見つかりません: ${placed.id}`);
      const placement: StlPlacement = {
        triangles: item.triangles,
        worldMin: item.worldMin,
        targetX: placed.x,
        targetZ: placed.z,
      };
      const stl = buildPlacedItemStl(placement);
      const path = `batches/${batchId}/plate-${plateIndex + 1}-${placed.id}.stl`;
      await bucket.file(path).save(stl, { contentType: "model/stl" });
      placedFiles.push({ gridId: placed.id, url: buildPublicUrl(bucket.name, path) });
    }
    results.push({ index: plateIndex + 1, itemCount: placedFiles.length, items: placedFiles });
    await updateProgress(
      jobRef,
      65 + Math.round(((plateIndex + 1) / plates.length) * 30),
      `STLを書き出し中... (プレート${plateIndex + 1}/${plates.length})`
    );
  }

  return { plates: results };
}

export const processJob = onDocumentCreated(
  { document: "jobs/{jobId}", ...JOB_RUNTIME_OPTS },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const jobRef = snap.ref;
    const job = snap.data() as JobDoc;

    await jobRef.update({
      status: "processing",
      progress: 0,
      message: "処理を開始しました",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      let result: unknown;
      if (job.type === "finish-mesh") {
        result = await runFinishMeshJob(
          jobRef,
          job.params as {
            itemId: string;
            wallThicknessMm: number;
            sphereSegments: number;
            bottomHoleXFraction?: number;
            bottomHoleZFraction?: number;
            bottomHoleDiameterMm?: number;
          }
        );
      } else if (job.type === "plate-layout") {
        result = await runPlateLayoutJob(jobRef, job.params as { batchId: string });
      } else {
        throw new Error(`未対応のジョブ種別です: ${job.type}`);
      }

      await jobRef.update({
        status: "completed",
        progress: 100,
        message: "完了しました",
        result,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`job ${snap.id} (${job.type}) failed`, error);
      await jobRef.update({
        status: "failed",
        error: error instanceof Error ? error.message : "処理に失敗しました",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
