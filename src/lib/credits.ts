import { FieldValue } from "firebase-admin/firestore";
import { MAX_DISCOUNTABLE_CREDITS } from "@/lib/creditPacks";
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
    tx.update(ref, { credits: credits - 1, creditsLastActivityAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function refundCredit(uid: string): Promise<void> {
  await userRef(uid).set(
    { credits: FieldValue.increment(1), creditsLastActivityAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function addCredits(uid: string, amount: number): Promise<void> {
  await userRef(uid).set(
    { credits: FieldValue.increment(amount), creditsLastActivityAt: FieldValue.serverTimestamp() },
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

// The finished-color preview (/api/generate-preview) is one paid Gemini image call per request and
// is re-run whenever the customer tries another color -- generous for real use, but a hard daily
// ceiling per account so a script (or a pile of throwaway Google accounts' worth of effort per
// account) can't run the shop's AI bill up without limit.
export const FINISHED_PREVIEWS_PER_DAY = 40;

export async function consumeFinishedPreviewAllowance(uid: string): Promise<boolean> {
  const ref = userRef(uid);
  const today = todayInJst();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const used = data?.finishedPreviewDate === today ? ((data?.finishedPreviewCount as number) ?? 0) : 0;
    if (used >= FINISHED_PREVIEWS_PER_DAY) return false;
    tx.set(ref, { finishedPreviewDate: today, finishedPreviewCount: used + 1 }, { merge: true });
    return true;
  });
}

/** Gives one back after a failed Gemini call, so a hiccup doesn't eat into the daily ceiling. */
export async function refundFinishedPreviewAllowance(uid: string): Promise<void> {
  const ref = userRef(uid);
  const today = todayInJst();
  await adminDb.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (data?.finishedPreviewDate !== today) return;
    tx.update(ref, { finishedPreviewCount: Math.max(0, ((data?.finishedPreviewCount as number) ?? 0) - 1) });
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

// A separate, much cheaper credit pool from the main (paid) 3D-reconstruction credits above --
// for customers who want to try several poses' shape previews in one sitting, past the free daily
// allowance, without committing to a full 3D model for each one. See PREVIEW_CREDIT_PRICE_YEN in
// creditPacks.ts.
export async function consumePreviewCredit(uid: string): Promise<boolean> {
  const ref = userRef(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const previewCredits = (snap.data()?.previewCredits as number) ?? 0;
    if (previewCredits <= 0) return false;
    tx.update(ref, { previewCredits: previewCredits - 1, creditsLastActivityAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function addPreviewCredits(uid: string, amount: number): Promise<void> {
  await userRef(uid).set(
    { previewCredits: FieldValue.increment(amount), creditsLastActivityAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Tries today's free preview allowance first, then falls back to a paid preview credit -- the
 * single gate /api/generate-model should call instead of checkAndConsumeFreeGeneration directly,
 * now that there are two ways to be "allowed". `usedPreviewCredit` tells the caller which pool to
 * refund from if generation then fails (see refundGenerationAllowance below).
 */
export async function checkAndConsumeGenerationAllowance(
  uid: string
): Promise<{ allowed: boolean; usedPreviewCredit: boolean }> {
  if (await checkAndConsumeFreeGeneration(uid)) {
    return { allowed: true, usedPreviewCredit: false };
  }
  const usedPreviewCredit = await consumePreviewCredit(uid);
  return { allowed: usedPreviewCredit, usedPreviewCredit };
}

export async function refundGenerationAllowance(
  uid: string,
  usedPreviewCredit: boolean
): Promise<void> {
  if (usedPreviewCredit) {
    await addPreviewCredits(uid, 1);
  } else {
    await refundFreeGeneration(uid);
  }
}

// Durable, account-level balance of "paid a real generation, haven't spent the resulting discount
// yet" -- unlike the in-progress cart's own generationCreditsUsed counter (plain React state, gone
// the moment the tab closes), this survives across sessions/days until actually redeemed at
// checkout. Mirrors referralDiscountAvailable's shape/lifecycle (see referral.ts): earned here,
// read live on mypage, consumed transactionally in /api/order-checkout.
export async function addDiscountableCredit(uid: string): Promise<void> {
  try {
    await userRef(uid).set(
      {
        generationCreditsAvailable: FieldValue.increment(1),
        creditsLastActivityAt: FieldValue.serverTimestamp(),
        // Drives the unread-notification dot on マイページ (see AuthNavButton.tsx) -- a bare
        // balance increment has no "when" for the dot to compare against lastSeenNotificationsAt.
        couponUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Worst case here is losing track of up to CREDIT_PRICE_YEN of discount eligibility -- not
    // worth failing the (already-charged) generation request over.
    console.error(`addDiscountableCredit failed for ${uid}`, error);
  }
}

/** Takes back one discountable credit (never below zero) -- the reverse of addDiscountableCredit,
 * used when the generation that earned it ended in failure and its credit was refunded. */
export async function removeDiscountableCredit(uid: string): Promise<void> {
  const ref = userRef(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const available = (snap.data()?.generationCreditsAvailable as number) ?? 0;
    if (available <= 0) return;
    tx.update(ref, { generationCreditsAvailable: available - 1, creditsLastActivityAt: FieldValue.serverTimestamp() });
  });
}

/** Atomically applies up to MAX_DISCOUNTABLE_CREDITS from the balance and returns how many were
 * actually applied (0 for a signed-out checkout, same as consumeReferralDiscount). */
export async function consumeDiscountableCredits(uid: string | null): Promise<number> {
  if (!uid) return 0;
  const ref = userRef(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const available = (snap.data()?.generationCreditsAvailable as number) ?? 0;
    const applied = Math.min(available, MAX_DISCOUNTABLE_CREDITS);
    if (applied <= 0) return 0;
    tx.update(ref, { generationCreditsAvailable: available - applied, creditsLastActivityAt: FieldValue.serverTimestamp() });
    return applied;
  });
}

/** Gives back a consumeDiscountableCredits() withdrawal after a failed checkout (e.g. Stripe
 * session creation error) -- mirrors the referral-discount rollback right next to it. */
export async function refundDiscountableCredits(uid: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await userRef(uid).set(
    { generationCreditsAvailable: FieldValue.increment(amount), creditsLastActivityAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
