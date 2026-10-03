import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { runOrderProcessing } from "@/lib/processOrder";

// Manual retry for a paid order whose post-payment processing (model scaling/fan-out) failed --
// this was previously unauthenticated, letting anyone trigger reprocessing for any orderId. Not
// directly exploitable for money (runOrderProcessing is idempotent), but there's no reason a
// non-admin should be able to call it at all.
export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

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
    const result = await runOrderProcessing(orderId);
    await adminDb
      .collection("orders")
      .doc(orderId)
      .update({ processingFailed: false, processingError: null })
      .catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    console.error("process-order failed", error);
    const message = error instanceof Error ? error.message : "注文処理に失敗しました";
    await adminDb
      .collection("orders")
      .doc(orderId)
      .update({ processingFailed: true, processingError: message })
      .catch(() => {});
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
