import { adminDb } from "@/lib/firebaseAdmin";

const COUNTER_REF = adminDb.collection("counters").doc("orders");
const PREFIX = "A";
const DIGITS = 8;

/**
 * Assigns the next sequential order number (A00000001, A00000002, ...) via an atomic Firestore
 * transaction, so two webhook deliveries racing each other (retries, near-simultaneous
 * checkouts) can never hand out the same number. Only called once a draft is actually promoted
 * to a paid order -- see the Stripe webhook -- so numbers stay dense and meaningful (no gaps
 * from abandoned checkouts) rather than mirroring every draft ever created.
 */
export async function getNextOrderNumber(): Promise<string> {
  const next = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(COUNTER_REF);
    const current = (snap.exists ? (snap.data()?.next as number) : undefined) ?? 1;
    tx.set(COUNTER_REF, { next: current + 1 }, { merge: true });
    return current;
  });
  return `${PREFIX}${String(next).padStart(DIGITS, "0")}`;
}
