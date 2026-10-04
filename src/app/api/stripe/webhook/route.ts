import { FieldValue } from "firebase-admin/firestore";
import { after, NextResponse, type NextRequest } from "next/server";
import { addCredits, addPreviewCredits, resetFreeGenerations } from "@/lib/credits";
import { sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmail } from "@/lib/emailTemplates";
import { adminDb } from "@/lib/firebaseAdmin";
import { upsertMarketingSubscriber } from "@/lib/marketing";
import { getNextOrderNumber } from "@/lib/orderNumber";
import { runOrderProcessing } from "@/lib/processOrder";
import { stripe } from "@/lib/stripe";
import type { OrderItemDraft } from "@/types/order";

// Post-payment work (model scaling, order-item fan-out, the confirmation email) runs in after() below;
// give the function room to finish it instead of being cut off at the platform default.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only card/PayPay-style methods that confirm instantly are enabled. If a delayed method (konbini,
    // bank transfer) were ever switched on in Stripe, "completed" would arrive BEFORE the money does --
    // don't promote the order or hand out credits until it is actually paid.
    if (session.payment_status === "unpaid") {
      console.warn(`Stripe session ${session.id} completed but not paid yet -- ignoring`);
      return NextResponse.json({ received: true });
    }

    if (session.metadata?.type === "order") {
      const orderId = session.metadata?.orderId;
      if (orderId) {
        // Promote the pre-payment draft into a real order, using the SAME id (so success_url's
        // ?orderId=, any links already handed out, etc. keep working) -- this is the one and
        // only place `orders/{orderId}` ever gets created; see submitOrder in src/lib/orders.ts
        // for why it isn't created client-side anymore. Idempotent against webhook retries: if
        // the draft is already gone (a previous delivery already consumed it), the order itself
        // must already exist, so just fall through to the (also idempotent) steps below.
        const draftRef = adminDb.collection("order_drafts").doc(orderId);
        const orderRef = adminDb.collection("orders").doc(orderId);
        const draftSnap = await draftRef.get();
        if (draftSnap.exists) {
          const draftData = draftSnap.data();
          const orderNumber = await getNextOrderNumber();
          // create() fails if the order already exists -- a duplicate or concurrent delivery of this
          // event must not overwrite it (and its order number).
          const created = await orderRef
            .create({
            ...draftData,
            // Stripe's own record of what was actually charged (set server-side in
            // /api/order-checkout from a re-derived price, never from the client-writable
            // draft) overrides whatever estimatedPriceYen the draft happens to carry -- the
            // draft is publicly writable with no field validation (see firestore.rules), so
            // trusting it here would let a tampered price leak into the admin-facing order
            // record even though the correct amount was actually collected.
            estimatedPriceYen: session.amount_total ?? draftData?.estimatedPriceYen,
            // Same reasoning: appliedGenerationCredits/verifiedDiscountYen are the values
            // /api/order-checkout actually verified and charged against (see
            // consumeDiscountableCredits in credits.ts) -- the draft's own generationCreditsUsed/
            // discountYen are just the client's unverified in-progress-cart estimate.
            generationCreditsUsed: draftData?.appliedGenerationCredits ?? 0,
            discountYen: draftData?.verifiedDiscountYen ?? 0,
            orderNumber,
            paymentStatus: "paid",
            paidAt: FieldValue.serverTimestamp(),
            })
            .then(() => true)
            .catch((error: { code?: number }) => {
              if (error?.code === 6) return false; // ALREADY_EXISTS
              throw error;
            });
          await draftRef.delete();
          // A paying customer shouldn't be locked out of previewing their NEXT design for the
          // rest of the day just because they used up today's free-preview allowance earlier.
          const uid = draftData?.uid as string | null | undefined;
          if (uid && created) {
            resetFreeGenerations(uid).catch((error) => {
              console.error(`resetFreeGenerations failed for order ${orderId}`, error);
            });
          }
        }
        // Run after the response has gone out (so Stripe isn't kept waiting on the slow model download
        // + scaling work and email), but inside after() -- a bare un-awaited promise can be frozen the
        // moment the serverless function returns, silently dropping paid orders. Failures are logged AND
        // flagged on the order doc itself, otherwise a paid order that fails here silently sits stuck
        // with nothing in the admin UI pointing at it. Cleared on a successful retry from the admin
        // order detail page.
        after(async () => {
          try {
            await runOrderProcessing(orderId);
          } catch (error) {
            console.error(`post-payment processing failed for order ${orderId}`, error);
            await orderRef
              .update({
                processingFailed: true,
                processingError: error instanceof Error ? error.message : String(error),
              })
              .catch((updateError) => {
                console.error(`failed to flag processingFailed for order ${orderId}`, updateError);
              });
          }

          try {
            // Claim the email first (atomically) so a duplicate delivery of this event can't send the
            // confirmation twice; if sending then fails, hand the claim back so a retry can send it.
            const claimed = await adminDb.runTransaction(async (tx) => {
              const s = await tx.get(orderRef);
              if (!s.exists || s.data()?.confirmationEmailSentAt) return false;
              tx.update(orderRef, { confirmationEmailSentAt: FieldValue.serverTimestamp() });
              return true;
            });
            if (!claimed) return;

            const snap = await orderRef.get();
            const order = snap.data() as
              | {
                  items: OrderItemDraft[];
                  estimatedPriceYen: number;
                  customerName: string;
                  customerEmail: string;
                  agreeMarketingEmail?: boolean;
                  orderNumber?: string;
                }
              | undefined;
            if (!order) return;

            try {
              const { subject, html } = buildOrderConfirmationEmail(order.orderNumber ?? orderId, order);
              await sendEmail({ to: order.customerEmail, subject, html });
            } catch (error) {
              await orderRef.update({ confirmationEmailSentAt: FieldValue.delete() }).catch(() => {});
              throw error;
            }

            if (order.agreeMarketingEmail) {
              await upsertMarketingSubscriber(order.customerEmail, order.customerName);
            }
          } catch (error) {
            console.error(`post-payment email step failed for order ${orderId}`, error);
          }
        });      }
    } else {
      const uid = session.metadata?.uid;
      const credits = Number(session.metadata?.credits ?? 0);
      const previewCredits = Number(session.metadata?.previewCredits ?? 0);
      if (uid && credits > 0) {
        await addCredits(uid, credits);
      }
      if (uid && previewCredits > 0) {
        await addPreviewCredits(uid, previewCredits);
      }
    }
  }

  return NextResponse.json({ received: true });
}
