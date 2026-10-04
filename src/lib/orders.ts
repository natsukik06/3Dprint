import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { calculateEstimate } from "@/lib/pricing";
import type { MagicColor, OrderFormValues, OrderRecord, SizeOption } from "@/types/order";

// Customer-provided model (bring-your-own), as opposed to AI-generated. Uploaded straight from the
// browser into the signed-in customer's OWN folder (Storage rules only allow writes there by that
// user, size-capped) -- it still flows through the same server-side scaling pipeline afterwards,
// which reads it by URL. The closed models/ folder is written by the server only.
export async function uploadCustomModel(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("ログインが必要です");
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modelRef = ref(storage, `custom-models/${uid}/custom-${uniqueId}.glb`);
  await uploadBytes(modelRef, file, { contentType: "model/gltf-binary" });
  return getDownloadURL(modelRef);
}

// Writes to `order_drafts`, NOT `orders` -- a draft only becomes a real order (visible in the
// admin panel) once Stripe confirms payment, via the webhook copying it over. This keeps
// abandoned/failed checkouts (someone fills the form, submits, then never completes payment) out
// of the admin's order list entirely, rather than leaving permanent "unpaid" clutter there.
export async function submitOrder(
  values: OrderFormValues,
  colorPriceYen: Partial<Record<MagicColor, Partial<Record<SizeOption, number>>>> = {}
): Promise<string> {
  // Display-only estimate written into the draft -- /api/order-checkout recomputes (and this
  // colorPriceYen argument lets it match) the authoritative charge amount server-side before
  // Stripe is ever involved, same as the rest of this figure.
  const { totalPriceYen, shippingYen, discountYen } = calculateEstimate({
    items: values.items,
    generationCreditsUsed: values.generationCreditsUsed,
    colorPriceYen,
  });

  const order: OrderRecord = {
    items: values.items,
    estimatedPriceYen: totalPriceYen,
    shippingYen,
    discountYen,
    generationCreditsUsed: values.generationCreditsUsed,
    shippingMethod: null,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    postalCode: values.postalCode,
    address: values.address,
    phoneNumber: values.phoneNumber,
    requestNote: values.requestNote ?? "",
    agreeShowcase: values.agreeShowcase,
    agreeMarketingEmail: values.agreeMarketingEmail,
    createdAt: serverTimestamp(),
    paymentStatus: "unpaid",
    paidAt: null,
    stripeCheckoutSessionId: null,
    insertPrinted: false,
    printed: false,
    printedAt: null,
    shipped: false,
    shippedAt: null,
    uid: auth.currentUser?.uid ?? null,
  };

  const docRef = await addDoc(collection(db, "order_drafts"), order);
  return docRef.id;
}
