import { NextResponse, type NextRequest } from "next/server";
import { releaseCheckout } from "@/lib/checkoutRelease";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

// Customer came back from Stripe's checkout page without paying: expire that session and hand back
// the referral discount / generation credits it consumed. See releaseCheckout.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderIdが必要です" }, { status: 400 });
  }
  try {
    const requester = await verifyRequestUser(request);
    const result = await releaseCheckout(orderId, requester?.uid ?? null);
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("order-checkout/release failed", error);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
