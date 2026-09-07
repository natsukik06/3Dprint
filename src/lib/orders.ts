import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { calculateEstimate } from "@/lib/pricing";
import type { OrderFormValues, OrderRecord } from "@/types/order";

function buildImagePath(file: File): string {
  const extension = file.name.split(".").pop() ?? "jpg";
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `orders/${uniqueId}.${extension}`;
}

export async function uploadReferencePhoto(file: File): Promise<string> {
  const imageRef = ref(storage, buildImagePath(file));
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

export async function uploadReferencePhotos(files: File[]): Promise<string[]> {
  return Promise.all(files.map(uploadReferencePhoto));
}

export async function getHostedModelUrl(taskId: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(storage, `models/${taskId}.glb`));
  } catch {
    return null;
  }
}

export async function uploadGeneratedModel(
  buffer: Buffer,
  taskId: string
): Promise<string> {
  const modelRef = ref(storage, `models/${taskId}.glb`);
  await uploadBytes(modelRef, new Uint8Array(buffer), {
    contentType: "model/gltf-binary",
  });
  return getDownloadURL(modelRef);
}

// Customer-provided model (bring-your-own), as opposed to AI-generated -- lands in the same
// `models/` path so it flows through the exact same server-side scaling/hollowing pipeline.
export async function uploadCustomModel(file: File): Promise<string> {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modelRef = ref(storage, `models/custom-${uniqueId}.glb`);
  await uploadBytes(modelRef, file, { contentType: "model/gltf-binary" });
  return getDownloadURL(modelRef);
}

export async function uploadFinishedPreview(
  buffer: Buffer,
  taskId: string
): Promise<string> {
  const previewRef = ref(storage, `previews/${taskId}.png`);
  await uploadBytes(previewRef, new Uint8Array(buffer), {
    contentType: "image/png",
  });
  return getDownloadURL(previewRef);
}

// Writes to `order_drafts`, NOT `orders` -- a draft only becomes a real order (visible in the
// admin panel) once Stripe confirms payment, via the webhook copying it over. This keeps
// abandoned/failed checkouts (someone fills the form, submits, then never completes payment) out
// of the admin's order list entirely, rather than leaving permanent "unpaid" clutter there.
export async function submitOrder(values: OrderFormValues): Promise<string> {
  const { totalPriceYen, shippingYen, discountYen } = calculateEstimate({
    items: values.items,
    generationCreditsUsed: values.generationCreditsUsed,
  });

  const order: OrderRecord = {
    items: values.items,
    estimatedPriceYen: totalPriceYen,
    shippingYen,
    discountYen,
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
    uid: auth.currentUser?.uid ?? null,
  };

  const docRef = await addDoc(collection(db, "order_drafts"), order);
  return docRef.id;
}
