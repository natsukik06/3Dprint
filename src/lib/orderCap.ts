import { adminDb } from "@/lib/firebaseAdmin";

// Solo-fabricated, so monthly capacity is capped rather than promising a lead time that can't be
// honored once orders pile up -- resets automatically at the start of each calendar month.
export const MONTHLY_ORDER_CAP = 200;

export async function isOrderingOpen(): Promise<boolean> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const snap = await adminDb
    .collection("orders")
    .where("createdAt", ">=", startOfMonth)
    .where("createdAt", "<", startOfNextMonth)
    .count()
    .get();

  return snap.data().count < MONTHLY_ORDER_CAP;
}
