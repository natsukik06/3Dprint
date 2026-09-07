import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";

// Matches the real production process: 0.8mm shell, later filled with
// clear epoxy + glitter through the cork hole (see production workflow).
const DEFAULT_WALL_THICKNESS_MM = 0.8;
// How finely the erosion sphere used for hollowing is approximated (see hollowMesh in
// functions/src/lib/meshBoolean.ts) -- more segments means a smoother inner wall at the cost of
// more triangles and slower boolean ops. Clamped to a sane range since this comes from the admin UI.
const DEFAULT_SPHERE_SEGMENTS = 32;
const MIN_SPHERE_SEGMENTS = 8;
const MAX_SPHERE_SEGMENTS = 64;

// The actual hollowing/hole-cutting work (manifold-3d boolean ops) runs in a Firebase Cloud
// Function (functions/src/index.ts, triggered by this job doc being created), not inline here --
// it's CPU-heavy enough to risk exceeding Vercel's serverless function timeout, and Cloud
// Functions gives it real headroom (up to 9 minutes) plus more memory. This route just enqueues
// the job and returns immediately; the admin UI watches the job doc for progress/completion.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: itemId } = await params;
  let wallThicknessMm = DEFAULT_WALL_THICKNESS_MM;
  let sphereSegments = DEFAULT_SPHERE_SEGMENTS;
  // Where the drain hole sits on the model's bottom face (0-1 fraction of its footprint).
  // Left undefined when not specified -- the Cloud Function falls back to its own default
  // (centered) or a legacy stored position, not to 0.5/0.5 hardcoded here.
  let bottomHoleXFraction: number | undefined;
  let bottomHoleZFraction: number | undefined;
  let bottomHoleDiameterMm: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.wallThicknessMm === "number" && body.wallThicknessMm > 0) {
      wallThicknessMm = body.wallThicknessMm;
    }
    if (typeof body?.sphereSegments === "number") {
      sphereSegments = Math.min(
        MAX_SPHERE_SEGMENTS,
        Math.max(MIN_SPHERE_SEGMENTS, Math.round(body.sphereSegments))
      );
    }
    if (
      typeof body?.bottomHoleXFraction === "number" &&
      body.bottomHoleXFraction >= 0 &&
      body.bottomHoleXFraction <= 1 &&
      typeof body?.bottomHoleZFraction === "number" &&
      body.bottomHoleZFraction >= 0 &&
      body.bottomHoleZFraction <= 1
    ) {
      bottomHoleXFraction = body.bottomHoleXFraction;
      bottomHoleZFraction = body.bottomHoleZFraction;
    }
    if (typeof body?.bottomHoleDiameterMm === "number" && body.bottomHoleDiameterMm > 0) {
      bottomHoleDiameterMm = body.bottomHoleDiameterMm;
    }
  } catch {
    // no body / invalid JSON — use defaults
  }

  try {
    const itemSnap = await adminDb.collection("order_items").doc(itemId).get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }

    const jobRef = await adminDb.collection("jobs").add({
      type: "finish-mesh",
      status: "queued",
      progress: 0,
      message: null,
      params: {
        itemId,
        wallThicknessMm,
        sphereSegments,
        bottomHoleXFraction,
        bottomHoleZFraction,
        bottomHoleDiameterMm,
      },
      result: null,
      error: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ jobId: jobRef.id });
  } catch (error) {
    console.error("finish-mesh job enqueue failed", error);
    const message = error instanceof Error ? error.message : "処理の予約に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
