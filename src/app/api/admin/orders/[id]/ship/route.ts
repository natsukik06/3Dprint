import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";
import { buildShippedNotificationEmail } from "@/lib/emailTemplates";
import { adminDb } from "@/lib/firebaseAdmin";
import type { OrderItemDraft } from "@/types/order";

// The single place `shipped` actually gets toggled now (see admin/page.tsx, admin/orders/[id]/
// page.tsx, admin/batches/[id]/page.tsx -- all three call this instead of writing to Firestore
// directly), so the shipped-notification email has exactly one trigger point no matter which
// admin screen the toggle happens from.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const { id: orderId } = await params;

  let shipped: unknown;
  try {
    const body = await request.json();
    shipped = body?.shipped;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (typeof shipped !== "boolean") {
    return NextResponse.json({ error: "shippedはboolean値が必要です" }, { status: 400 });
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
    }
    const order = snap.data() as {
      orderNumber?: string;
      items: OrderItemDraft[];
      customerName: string;
      customerEmail: string;
      uid: string | null;
      shipped?: boolean;
    };
    const wasShipped = order.shipped === true;

    await orderRef.update({
      shipped,
      shippedAt: shipped ? FieldValue.serverTimestamp() : null,
    });

    // Best-effort, fire-and-forget -- a Resend hiccup (or RESEND_API_KEY not being set yet) must
    // never fail the shipped toggle itself. Only fires on an actual false->true transition, so
    // correcting a mis-click (toggling off then on again) doesn't re-send it.
    if (shipped && !wasShipped) {
      const origin = request.headers.get("origin") ?? new URL(request.url).origin;
      const referralUrl = order.uid ? `${origin}/?ref=${order.uid}` : null;
      const { subject, html } = buildShippedNotificationEmail(
        order.orderNumber ?? orderId,
        order,
        referralUrl
      );
      sendEmail({ to: order.customerEmail, subject, html }).catch((error) => {
        console.error(`shipped-notification email failed for order ${orderId}`, error);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ship toggle failed", error);
    const message = error instanceof Error ? error.message : "更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
