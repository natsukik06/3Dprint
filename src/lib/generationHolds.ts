import { FieldValue } from "firebase-admin/firestore";
import { refundCredits, removeDiscountableCredit } from "@/lib/credits";
import { adminDb } from "@/lib/firebaseAdmin";

// Server-only record of "this paid 3D generation (Tripo task) was bought with this user's credit" --
// kept in its own collection (no Firestore rule opens it to clients) so a failed task can hand the
// credit back to the right person, exactly once, no matter who polls the task or how often.
const holds = () => adminDb.collection("generation_holds");

export async function recordGenerationHold(
  taskId: string,
  uid: string,
  credits = 1
): Promise<void> {
  try {
    await holds().doc(taskId).set({
      uid,
      credits,
      refunded: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // The task is already created and charged; losing the refund record is the lesser evil.
    console.error(`recordGenerationHold failed for ${taskId}`, error);
  }
}

/**
 * Gives the credit back for a Tripo task that ended in failure (Tripo itself doesn't bill failed or
 * cancelled tasks). Also takes back the "generation-fee discount" earned when the task was queued
 * (see addDiscountableCredit), otherwise a failure would net the customer a free discount.
 * Idempotent: the refund is claimed atomically on the hold.
 */
export async function refundFailedGeneration(taskId: string): Promise<boolean> {
  const ref = holds().doc(taskId);
  const claimed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!snap.exists || data?.refunded) return null;
    tx.update(ref, { refunded: true, refundedAt: FieldValue.serverTimestamp() });
    const uid = (data?.uid as string) ?? null;
    return uid ? { uid, credits: (data?.credits as number) ?? 1 } : null;
  });
  if (!claimed) return false;
  const claimedUid = claimed.uid;
  await refundCredits(claimedUid, claimed.credits);
  await removeDiscountableCredit(claimedUid).catch((error) =>
    console.error(`removeDiscountableCredit failed for ${taskId}`, error)
  );
  return true;
}
