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

const FREE_GENERATIONS_PER_DAY = 2;

// Day boundary in JST (the shop's own timezone), not UTC or the server's local time -- en-CA
// gives an unambiguous YYYY-MM-DD.
function todayInJst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

/**
 * Generating the 4 turnaround-view images (the first, cheaper half of 3D generation -- see
 * /api/generate-model) is free, up to FREE_GENERATIONS_PER_DAY per account per day, rather than
 * spending a paid credit. The credit itself is only spent later, in /api/generate-model/confirm,
 * once the customer commits to the (paid) Tripo reconstruction. Returns false once today's free
 * allowance is used up -- the caller should reject the request, not fall back to charging a
 * credit (that would defeat the point of a free preview step).
 */
export async function checkAndConsumeFreeGeneration(uid: string): Promise<boolean> {
  const ref = userRef(uid);
  const today = todayInJst();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const sameDay = data?.freeGenerationDate === today;
    const usedToday = sameDay ? ((data?.freeGenerationCount as number) ?? 0) : 0;
    if (usedToday >= FREE_GENERATIONS_PER_DAY) return false;
    tx.set(
      ref,
      { freeGenerationDate: today, freeGenerationCount: usedToday + 1 },
      { merge: true }
    );
    return true;
  });
}

/** Gives back one of today's free generations after a failed attempt -- a Gemini hiccup
 * shouldn't cost the customer part of their daily allowance. Mirrors refundCredit above. */
export async function refundFreeGeneration(uid: string): Promise<void> {
  const ref = userRef(uid);
  const today = todayInJst();
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (data?.freeGenerationDate !== today) return; // day already rolled over, nothing to give back
    const current = (data?.freeGenerationCount as number) ?? 0;
    tx.update(ref, { freeGenerationCount: Math.max(0, current - 1) });
  });
}

/**
 * Called once a draft is promoted to a real (paid) order -- see the Stripe webhook -- so a
 * customer who already used up today's free previews before ordering isn't then locked out of
 * previewing their NEXT design for the rest of the day just because they paid early.
 */
export async function resetFreeGenerations(uid: string): Promise<void> {
  await userRef(uid).set(
    { freeGenerationDate: todayInJst(), freeGenerationCount: 0 },
    { merge: true }
  );
}
