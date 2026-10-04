import { FieldValue, type Firestore } from "firebase-admin/firestore";

// Retention rules promised on the legal pages (特商法 / プライバシーポリシー):
//  - reference photos customers uploaded are deleted one year after upload;
//  - 3D-generation credits (and the discounts they earn) expire one year after the account's last
//    credit activity (purchase, use, refund) -- tracked in users/{uid}.creditsLastActivityAt, which
//    the web app's credit helpers keep up to date (src/lib/credits.ts).
// Only the parts of a Storage bucket this job touches -- avoids pinning the @google-cloud/storage
// type (firebase-admin ships two builds of it whose Bucket types are not interchangeable).
type PhotoFile = { name: string; metadata: { timeCreated?: unknown }; delete: () => Promise<unknown> };
export type BucketLike = { getFiles: (options: { prefix: string }) => Promise<[PhotoFile[], ...unknown[]]> };

export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export type ExpiryResult = {
  photosExamined: number;
  photosDeleted: number;
  accountsClockStarted: number;
  accountsExpired: number;
  creditsExpired: number;
  draftsDeleted: number;
  holdsReleased: number;
  holdsDeleted: number;
};

export async function runExpiryCleanup(
  db: Firestore,
  bucket: BucketLike,
  { dryRun = false, now = Date.now() }: { dryRun?: boolean; now?: number } = {}
): Promise<ExpiryResult> {
  const result: ExpiryResult = {
    photosExamined: 0,
    photosDeleted: 0,
    accountsClockStarted: 0,
    accountsExpired: 0,
    creditsExpired: 0,
    draftsDeleted: 0,
    holdsReleased: 0,
    holdsDeleted: 0,
  };

  // 1) Reference photos: every file under orders/ older than one year.
  const [photos] = await bucket.getFiles({ prefix: "orders/" });
  for (const file of photos) {
    result.photosExamined++;
    const created = Date.parse(String(file.metadata.timeCreated ?? ""));
    if (!Number.isFinite(created) || now - created < RETENTION_MS) continue;
    if (!dryRun) {
      try {
        await file.delete();
      } catch (error) {
        const code = (error as { code?: number })?.code;
        if (code !== 404) {
          console.error(`failed to delete expired photo ${file.name}`, error);
          continue;
        }
      }
    }
    result.photosDeleted++;
  }

  // 2) Credits: zero out balances of accounts with no credit activity for a year. Accounts that
  // hold credits but have no activity timestamp yet (created before this tracking existed) get the
  // clock started today instead of being expired on the spot.
  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const credits = Number(data.credits ?? 0);
    const previewCredits = Number(data.previewCredits ?? 0);
    const discountable = Number(data.generationCreditsAvailable ?? 0);
    if (credits <= 0 && previewCredits <= 0 && discountable <= 0) continue;

    const lastActivity = data.creditsLastActivityAt?.toDate?.() as Date | undefined;
    if (!lastActivity) {
      if (!dryRun) await userDoc.ref.update({ creditsLastActivityAt: FieldValue.serverTimestamp() });
      result.accountsClockStarted++;
      continue;
    }
    if (now - lastActivity.getTime() < RETENTION_MS) continue;

    if (!dryRun) {
      await userDoc.ref.update({
        credits: 0,
        previewCredits: 0,
        generationCreditsAvailable: 0,
        creditsExpiredAt: FieldValue.serverTimestamp(),
        creditsExpiredAmount: { credits, previewCredits, discountable },
      });
    }
    result.accountsExpired++;
    result.creditsExpired += credits + previewCredits + discountable;
  }

  // 3) Unpaid order drafts (created when someone presses "決済へ進む" but never pays) hold a name,
  // address and phone number; they are deleted after 14 days, as the privacy policy says.
  const DRAFT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
  const draftsSnap = await db.collection("order_drafts").get();
  for (const draft of draftsSnap.docs) {
    const created = draft.data().createdAt?.toDate?.() as Date | undefined;
    if (!created || now - created.getTime() < DRAFT_RETENTION_MS) continue;
    if (!dryRun) await draft.ref.delete();
    result.draftsDeleted++;
  }

  // 4) Checkout holds: a Stripe payment page lasts 24h. If the customer left without paying and never
  // came back to the site (so the release API was never called), hand back the referral discount and
  // generation credits it took -- but only when no order exists for that checkout. Old holds are then
  // removed.
  const HOLD_GRACE_MS = 2 * 24 * 60 * 60 * 1000;
  const holdsSnap = await db.collection("checkout_holds").get();
  for (const hold of holdsSnap.docs) {
    const data = hold.data();
    const created = data.createdAt?.toDate?.() as Date | undefined;
    if (!created) continue;
    const age = now - created.getTime();

    if (!data.released && age >= HOLD_GRACE_MS) {
      const orderExists = (await db.collection("orders").doc(hold.id).get()).exists;
      if (!orderExists) {
        if (!dryRun) {
          // Claim first (so a retry or a concurrent release can't hand it back twice).
          const claimed = await db.runTransaction(async (tx) => {
            const fresh = await tx.get(hold.ref);
            if (!fresh.exists || fresh.data()?.released) return false;
            tx.update(hold.ref, { released: true, releasedBy: "expiry-job" });
            return true;
          });
          if (claimed && data.uid) {
            const userRef = db.collection("users").doc(data.uid as string);
            if (data.referralDiscount) await userRef.update({ referralDiscountAvailable: true });
            const credits = Number(data.credits ?? 0);
            if (credits > 0) await userRef.set({ generationCreditsAvailable: FieldValue.increment(credits) }, { merge: true });
          }
        }
        result.holdsReleased++;
      }
    }

    if (age >= DRAFT_RETENTION_MS) {
      if (!dryRun) await hold.ref.delete();
      result.holdsDeleted++;
    }
  }
  return result;
}
