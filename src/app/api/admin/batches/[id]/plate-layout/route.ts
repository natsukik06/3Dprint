import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";

// As with finish-mesh, the actual work (downloading every item's model, packing them onto
// plates, writing per-item STLs) runs in a Firebase Cloud Function -- a full batch can mean
// downloading and processing up to 30 models in one go, which risks Vercel's serverless timeout.
// This route only enqueues the job.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: batchId } = await params;

  try {
    const batchSnap = await adminDb.collection("print_batches").doc(batchId).get();
    if (!batchSnap.exists) {
      return NextResponse.json({ error: "バッチが見つかりません" }, { status: 404 });
    }

    const jobRef = await adminDb.collection("jobs").add({
      type: "plate-layout",
      status: "queued",
      progress: 0,
      message: null,
      params: { batchId },
      result: null,
      error: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ jobId: jobRef.id });
  } catch (error) {
    console.error("plate-layout job enqueue failed", error);
    const message = error instanceof Error ? error.message : "処理の予約に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
