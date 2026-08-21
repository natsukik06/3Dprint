import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { addCredits } from "@/lib/credits";
import { adminDb } from "@/lib/firebaseAdmin";
import { runOrderProcessing } from "@/lib/processOrder";
import { stripe } from "@/lib/stripe";

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

    if (session.metadata?.type === "order") {
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await adminDb.collection("orders").doc(orderId).update({
          paymentStatus: "paid",
          paidAt: FieldValue.serverTimestamp(),
        });
        // Fire-and-forget: don't block the webhook response on the (slower)
        // model download + scaling work. Failures are logged and can be
        // retried manually from the admin order detail page.
        runOrderProcessing(orderId).catch((error) => {
          console.error(`post-payment processing failed for order ${orderId}`, error);
        });
      }
    } else {
      const uid = session.metadata?.uid;
      const credits = Number(session.metadata?.credits ?? 0);
      if (uid && credits > 0) {
        await addCredits(uid, credits);
      }
    }
  }

  return NextResponse.json({ received: true });
}
