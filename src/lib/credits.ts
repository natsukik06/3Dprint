import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const FREE_SIGNUP_CREDITS = 1;

function userRef(uid: string) {
  return adminDb.collection("users").doc(uid);
}

export async function getOrCreateUserCredits(
  uid: string,
  email: string | null
): Promise<number> {
  const ref = userRef(uid);
  const snap = await ref.get();
  if (snap.exists) {
    return (snap.data()?.credits as number) ?? 0;
  }

  await ref.set({
    credits: FREE_SIGNUP_CREDITS,
    email,
    createdAt: FieldValue.serverTimestamp(),
  });
  return FREE_SIGNUP_CREDITS;
}

/** Atomically deducts one credit. Returns false if the user has none left. */
export async function consumeCredit(uid: string): Promise<boolean> {
  const ref = userRef(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const credits = (snap.data()?.credits as number) ?? 0;
    if (credits <= 0) return false;
    tx.update(ref, { credits: credits - 1 });
    return true;
  });
}

export async function refundCredit(uid: string): Promise<void> {
  await userRef(uid).set(
    { credits: FieldValue.increment(1) },
    { merge: true }
  );
}

export async function addCredits(uid: string, amount: number): Promise<void> {
  await userRef(uid).set(
    { credits: FieldValue.increment(amount) },
    { merge: true }
  );
}
