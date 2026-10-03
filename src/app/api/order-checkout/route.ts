import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { colorPriceBySizeMap, enabledColors } from "@/lib/colorSettings";
import { getColorSettings } from "@/lib/colorSettingsAdmin";
import { GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN } from "@/lib/creditPacks";
import { consumeDiscountableCredits, refundDiscountableCredits } from "@/lib/credits";
import { adminDb } from "@/lib/firebaseAdmin";
import { stripe } from "@/lib/stripe";
import { calculateEstimate } from "@/lib/pricing";
import { checkWeeklyCapacity } from "@/lib/orderCap";
import { AVAILABLE_SIZE_OPTIONS, orderItemSchema, type MagicColor } from "@/types/order";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

const draftItemsSchema = z.array(orderItemSchema).min(1);

// Atomically checks-and-consumes the caller's referral discount flag, if any -- a transaction so
// two concurrent checkout attempts can't both read "available" and each apply the same one-time
// 20% off. Returns whether it was (successfully) applied to THIS checkout.
async function consumeReferralDiscount(uid: string | null): Promise<boolean> {
  if (!uid) return false;
  const userRef = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.data()?.referralDiscountAvailable) return false;
    tx.update(userRef, { referralDiscountAvailable: false });
    return true;
  });
}

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
    // Reads the pre-payment draft (order_drafts), not orders -- the real orders/{orderId} doc
    // doesn't exist yet at this point; the webhook creates it, using this same id, once Stripe
    // confirms payment. See submitOrder in src/lib/orders.ts for why.
    const draftRef = adminDb.collection("order_drafts").doc(orderId);
    const snap = await draftRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
    }

    const order = snap.data() as {
      items: unknown;
      generationCreditsUsed?: number;
      paymentStatus: "unpaid" | "paid";
    };

    // Re-derive the charge amount from the validated items server-side -- order_drafts accepts
    // unauthenticated writes with no field validation (see firestore.rules), so a client could
    // otherwise write an arbitrary estimatedPriceYen directly and have this route charge that
    // instead of the real price. The draft's own generationCreditsUsed is NOT used for the
    // discount (see below) -- it's just an informational "how many generations went into this
    // cart" figure now, not proof of anything spendable.
    const parsedItems = draftItemsSchema.safeParse(order.items);
    if (!parsedItems.success) {
      return NextResponse.json({ error: "注文内容が不正です" }, { status: 400 });
    }

    // A color hidden from /admin/colors must not be orderable even via a direct API call --
    // order_drafts accepts unauthenticated writes with no field validation (see the comment
    // above), so this is the actual enforcement point, same as the weekly-capacity check below.
    const colorSettings = await getColorSettings();
    const allowedColors = new Set(enabledColors(colorSettings));
    const hasDisabledColor = parsedItems.data.some((item) =>
      Object.entries(item.colorQuantities).some(
        ([color, qty]) => qty > 0 && !allowedColors.has(color as MagicColor)
      )
    );
    if (hasDisabledColor) {
      return NextResponse.json({ error: "選択できないカラーが含まれています" }, { status: 400 });
    }

    // Sizes not on sale yet (see AVAILABLE_SIZE_OPTIONS) can't be ordered via a direct API call
    // either -- the draft is publicly writable, so this is the real enforcement point.
    const hasUnavailableSize = parsedItems.data.some(
      (item) => !(AVAILABLE_SIZE_OPTIONS as readonly string[]).includes(item.sizeOption)
    );
    if (hasUnavailableSize) {
      return NextResponse.json({ error: "現在ご注文いただけないサイズが含まれています" }, { status: 400 });
    }

    // isOrderingOpen() also gates whether /order even renders the form (see src/app/order/page.tsx),
    // but that's only a page-load-time, cart-agnostic check -- order_drafts accepts unauthenticated
    // writes and this route had no other cap check, so without this a customer (or a direct API
    // call) could still complete a real paid order past the weekly per-line cap. This is the actual
    // money-changing-hands moment, so it's the right place to enforce it server-side, now with the
    // real cart contents so each product line's own cap is checked correctly.
    const capacity = await checkWeeklyCapacity(parsedItems.data);
    if (!capacity.ok) {
      return NextResponse.json({ error: capacity.reason }, { status: 403 });
    }

    // Optional auth -- guests can still check out with no referral/generation discount; only a
    // signed-in caller with an unclaimed referral flag or discountable-credit balance gets them,
    // each consumed (atomically, capped) exactly here at the real charge moment -- see
    // consumeDiscountableCredits in src/lib/credits.ts, mirroring consumeReferralDiscount below.
    const requester = await verifyRequestUser(request);
    const referralDiscountActive = await consumeReferralDiscount(requester?.uid ?? null);
    // The generation-fee refund only applies from a ¥1,000 merchandise subtotal -- check that BEFORE
    // consuming any credits, so a smaller order doesn't burn the customer's balance for no discount.
    const { subtotalYen: merchandiseSubtotalYen } = calculateEstimate({
      items: parsedItems.data,
      colorPriceYen: colorPriceBySizeMap(colorSettings),
    });
    const appliedGenerationCredits =
      merchandiseSubtotalYen >= GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN
        ? await consumeDiscountableCredits(requester?.uid ?? null)
        : 0;
    const estimate = calculateEstimate({
      items: parsedItems.data,
      generationCreditsUsed: appliedGenerationCredits,
      referralDiscountActive,
      colorPriceYen: colorPriceBySizeMap(colorSettings),
    });
    if (!(estimate.totalPriceYen > 0)) {
      return NextResponse.json({ error: "金額が不正です" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const subjects = parsedItems.data.map((item) => item.subject).filter(Boolean);
    const setLabel =
      subjects.length > 0 ? subjects.join(" / ") : "カスタムフィギュア";

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        // No payment_method_types here on purpose -- see the same note in
        // /api/stripe/checkout/route.ts. All our line items are jpy already.
        metadata: { orderId, type: "order" },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "jpy",
              unit_amount: estimate.totalPriceYen,
              product_data: {
                name: `オーダーメイドフィギュアセット「${setLabel}」`,
              },
            },
          },
        ],
        success_url: `${origin}/order?checkout=success&orderId=${orderId}`,
        cancel_url: `${origin}/order?checkout=cancel`,
      });
    } catch (error) {
      // Give back the discounts we already consumed above -- a Stripe hiccup here shouldn't cost
      // the customer their one-time referral discount or their generation-credit balance.
      if (referralDiscountActive && requester) {
        await adminDb
          .collection("users")
          .doc(requester.uid)
          .update({ referralDiscountAvailable: true })
          .catch(() => {});
      }
      if (requester && appliedGenerationCredits > 0) {
        await refundDiscountableCredits(requester.uid, appliedGenerationCredits).catch(() => {});
      }
      throw error;
    }

    // Verified server-side values for the webhook to trust when promoting this draft into the
    // real order (see stripe/webhook/route.ts) -- the draft's own generationCreditsUsed/
    // discountYen are client-writable and no longer treated as authoritative.
    await draftRef.update({
      stripeCheckoutSessionId: session.id,
      appliedGenerationCredits,
      verifiedDiscountYen: estimate.discountYen,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("order checkout session creation failed", error);
    return NextResponse.json(
      { error: "決済セッションの作成に失敗しました" },
      { status: 502 }
    );
  }
}
