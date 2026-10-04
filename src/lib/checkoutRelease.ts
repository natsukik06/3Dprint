import { refundDiscountableCredits } from "@/lib/credits";
import { adminDb } from "@/lib/firebaseAdmin";
import { stripe } from "@/lib/stripe";

export type ReleaseResult =
  | { status: "released" }
  | { status: "nothing_to_release" }
  | { status: "already_paid" }
  | { status: "forbidden" };

/**
 * Called when a customer comes back from Stripe's checkout page without paying (the cart_url /
 * "戻る" link). /api/order-checkout consumes the one-time referral discount and generation credits
 * when it CREATES the checkout session, so without this a customer who backs out loses them.
 *
 * Order matters: the Stripe session is expired first (so it can't be paid later after the discounts
 * have been handed back), and if it turns out to be already paid we release nothing -- the webhook
 * owns that order. The refund itself is claimed atomically on the draft so repeated calls (reload,
 * double click) can't refund twice.
 */
export async function releaseCheckout(
  orderId: string,
  requesterUid: string | null
): Promise<ReleaseResult> {
  const holdRef = adminDb.collection("checkout_holds").doc(orderId);
  const snap = await holdRef.get();
  // No hold = this checkout never consumed anything (or it was never created) -- nothing to give
  // back. Because only the server writes holds, a caller can't invent a refund by forging a draft.
  if (!snap.exists) return { status: "nothing_to_release" };

  const hold = snap.data() as {
    sessionId?: string | null;
    uid?: string | null;
    credits?: number;
    referralDiscount?: boolean;
    released?: boolean;
  };

  // Only the signed-in customer the discounts were taken from may hand them back to themselves.
  if (hold.uid && hold.uid !== requesterUid) return { status: "forbidden" };
  if (hold.released) return { status: "nothing_to_release" };

  if (hold.sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(hold.sessionId);
      if (session.status === "complete") return { status: "already_paid" };
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(hold.sessionId);
      }
    } catch (error) {
      // If we can't tell whether it was paid, don't refund -- better to leave a discount spent
      // (fixable by hand) than to hand it back for an order that actually went through.
      console.error(`releaseCheckout: could not verify/expire session for ${orderId}`, error);
      return { status: "nothing_to_release" };
    }
  }

  const claimed = await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(holdRef);
    if (!fresh.exists || fresh.data()?.released) return false;
    tx.update(holdRef, { released: true });
    return true;
  });
  if (!claimed) return { status: "nothing_to_release" };

  const uid = hold.uid;
  if (uid) {
    if (hold.referralDiscount) {
      await adminDb
        .collection("users")
        .doc(uid)
        .update({ referralDiscountAvailable: true })
        .catch((error) => console.error(`releaseCheckout: referral restore failed for ${orderId}`, error));
    }
    const credits = hold.credits ?? 0;
    if (credits > 0) {
      await refundDiscountableCredits(uid, credits).catch((error) =>
        console.error(`releaseCheckout: credit refund failed for ${orderId}`, error)
      );
    }
  }
  return { status: "released" };
}
