import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

// Deterministic per-email doc id (not a hash of anything secret) so re-opting-in from a later
// order updates the same subscriber instead of creating a duplicate.
function subscriberId(email: string): string {
  return Buffer.from(email.trim().toLowerCase()).toString("base64url");
}

/**
 * Adds (or re-activates) a marketing email subscriber. Only ever called server-side after a real
 * paid order with agreeMarketingEmail=true -- this is the one place someone gets added to the
 * list, so every subscriber has demonstrably opted in (required under Japan's 特定電子メール法).
 */
export async function upsertMarketingSubscriber(
  email: string,
  customerName: string
): Promise<void> {
  const id = subscriberId(email);
  const ref = adminDb.collection("marketing_subscribers").doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({
      subscribed: true,
      customerName,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  await ref.set({
    email: email.trim().toLowerCase(),
    customerName,
    subscribed: true,
    unsubscribeToken: randomUUID(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Flips a subscriber to unsubscribed by their one-click link token. Returns false if not found. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const snap = await adminDb
    .collection("marketing_subscribers")
    .where("unsubscribeToken", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return false;
  await snap.docs[0].ref.update({
    subscribed: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

export type MarketingSubscriber = {
  email: string;
  customerName: string;
  unsubscribeToken: string;
};

export async function getSubscribedRecipients(): Promise<MarketingSubscriber[]> {
  const snap = await adminDb
    .collection("marketing_subscribers")
    .where("subscribed", "==", true)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      email: data.email as string,
      customerName: (data.customerName as string) ?? "",
      unsubscribeToken: data.unsubscribeToken as string,
    };
  });
}
