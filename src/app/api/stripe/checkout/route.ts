import { NextResponse, type NextRequest } from "next/server";
import { CREDIT_PACKS, CREDIT_PRICE_YEN, MAX_CUSTOM_CREDITS } from "@/lib/creditPacks";
import { stripe } from "@/lib/stripe";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { packId, customCredits } = await request.json();

  // Either a fixed pack, or a customer-chosen quantity priced at the same per-credit rate.
  let credits: number;
  let priceYen: number;
  if (packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "無効なプランです" }, { status: 400 });
    }
    credits = pack.credits;
    priceYen = pack.priceYen;
  } else {
    const parsed = Number(customCredits);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_CUSTOM_CREDITS) {
      return NextResponse.json(
        { error: `個数は1〜${MAX_CUSTOM_CREDITS}の範囲で指定してください` },
        { status: 400 }
      );
    }
    credits = parsed;
    priceYen = parsed * CREDIT_PRICE_YEN;
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // No payment_method_types here on purpose -- Stripe's "dynamic payment methods" decides
      // what to show (card, PayPay, etc.) based on what's turned on in the Dashboard
      // (https://dashboard.stripe.com/settings/payment_methods), plus currency/amount/customer
      // eligibility. All line items are jpy, which is required for PayPay to be offered.
      client_reference_id: user.uid,
      metadata: { uid: user.uid, credits: String(credits) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: priceYen,
            product_data: { name: `生成クレジット ${credits}回分` },
          },
        },
      ],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("stripe checkout session creation failed", error);
    return NextResponse.json(
      { error: "決済セッションの作成に失敗しました" },
      { status: 502 }
    );
  }
}
