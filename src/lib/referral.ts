import { adminDb } from "@/lib/firebaseAdmin";

type ClaimResult = { ok: true } | { ok: false; error: string };

// Called once, right after a brand-new account finishes its first sign-in, if a referral link
// (?ref=<referrerUid>) was captured on the way in -- see ReferralCapture.tsx and
// signInWithGoogle in src/lib/auth.ts. Grants both sides one unclaimed 20%-off flag
// (referralDiscountAvailable), consumed later at checkout (see /api/order-checkout).
export async function claimReferral(
  newUid: string,
  referrerUid: string
): Promise<ClaimResult> {
  const referrerRef = adminDb.collection("users").doc(referrerUid);
  const newUserRef = adminDb.collection("users").doc(newUid);

  const referrerSnap = await referrerRef.get();
  if (!referrerSnap.exists) {
    return { ok: false, error: "招待リンクが無効です" };
  }

  return adminDb.runTransaction(async (tx): Promise<ClaimResult> => {
    const newUserSnap = await tx.get(newUserRef);
    // referredBy is set exactly once per account -- re-visiting a referral link (or someone
    // else's) after the first claim must not grant another discount.
    if (newUserSnap.exists && newUserSnap.data()?.referredBy) {
      return { ok: false, error: "紹介リンクはすでに利用済みです" };
    }
    tx.set(
      newUserRef,
      { referredBy: referrerUid, referralDiscountAvailable: true },
      { merge: true }
    );
    tx.set(referrerRef, { referralDiscountAvailable: true }, { merge: true });
    return { ok: true };
  });
}
