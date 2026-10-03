import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Account-linked 注文者情報 -- saved once (at checkout, or from /mypage's 設定) so a returning,
// signed-in customer doesn't have to retype name/address/phone on every order. Lives on the same
// users/{uid} doc as the referral flag; firestore.rules restricts client writes to exactly these
// four fields so this can never touch referralDiscountAvailable.
export type CustomerProfile = {
  customerName: string;
  postalCode: string;
  address: string;
  phoneNumber: string;
};

export async function getCustomerProfile(uid: string): Promise<Partial<CustomerProfile> | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const profile: Partial<CustomerProfile> = {
    customerName: data.customerName,
    postalCode: data.postalCode,
    address: data.address,
    phoneNumber: data.phoneNumber,
  };
  const hasAny = Object.values(profile).some((v) => typeof v === "string" && v.trim() !== "");
  return hasAny ? profile : null;
}

export async function saveCustomerProfile(
  uid: string,
  profile: Partial<CustomerProfile>
): Promise<void> {
  await setDoc(doc(db, "users", uid), profile, { merge: true });
}
