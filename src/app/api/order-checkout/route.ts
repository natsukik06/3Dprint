import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { stripe } from "@/lib/stripe";

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
      subject: string;
      estimatedPriceYen: number;
      paymentStatus: "unpaid" | "paid";
    };

    if (order.paymentStatus === "paid") {
      return NextResponse.json({ status: "already_paid" });
    }
    if (!(order.estimatedPriceYen > 0)) {
      return NextResponse.json({ error: "金額が不正です" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      metadata: { orderId, type: "order" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: order.estimatedPriceYen,
            product_data: {
              name: `オーダーメイドフィギュア「${order.subject || "カスタムフィギュア"}」`,
            },
          },
        },
      ],
      success_url: `${origin}/order?checkout=success&orderId=${orderId}`,
      cancel_url: `${origin}/order?checkout=cancel`,
    });

    await orderRef.update({ stripeCheckoutSessionId: session.id });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("order checkout session creation failed", error);
    return NextResponse.json(
      { error: "決済セッションの作成に失敗しました" },
      { status: 502 }
    );
  }
}
