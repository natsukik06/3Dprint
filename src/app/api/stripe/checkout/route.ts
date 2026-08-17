import { NextResponse, type NextRequest } from "next/server";
import { CREDIT_PACKS } from "@/lib/creditPacks";
import { stripe } from "@/lib/stripe";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { packId } = await request.json();
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "無効なプランです" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: user.uid,
      metadata: { uid: user.uid, credits: String(pack.credits) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: pack.priceYen,
            product_data: { name: `生成クレジット ${pack.credits}回分` },
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
