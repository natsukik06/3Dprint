import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { calculateEstimate } from "@/lib/pricing";
import type { MagicColor, OrderFormValues, OrderRecord } from "@/types/order";

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

export async function submitOrder(
  values: OrderFormValues,
  modelUrl: string | null,
  finishedPreviewUrls: Partial<Record<MagicColor, string>>,
  referenceImageUrls: string[]
): Promise<string> {
  const { totalPriceYen, shippingYen, discountYen } = calculateEstimate({
    colorQuantities: values.colorQuantities,
    generationCreditsUsed: values.generationCreditsUsed,
  });

  const order: OrderRecord = {
    referenceImageUrls,
    modelUrl,
    finishedPreviewUrls,
    subject: values.subject,
    pose: values.pose,
    sizeOption: values.sizeOption,
    colorQuantities: values.colorQuantities,
    estimatedPriceYen: totalPriceYen,
    shippingYen,
    discountYen,
    wantsHardware: values.wantsHardware,
    holePosition: values.wantsHardware ? values.holePosition : null,
    bottomHolePosition: values.bottomHolePosition,
    bottomHoleDiameterMm: values.bottomHolePosition
      ? values.bottomHoleDiameterMm
      : null,
    customerName: values.customerName,
    customerEmail: values.customerEmail,
    postalCode: values.postalCode,
    address: values.address,
    phoneNumber: values.phoneNumber,
    deliveryDate: values.deliveryDate || null,
    deliveryTimeSlot: values.deliveryTimeSlot,
    requestNote: values.requestNote ?? "",
    createdAt: serverTimestamp(),
    shippingMethod: null,
    modelBoundingBoxMm: null,
    scaledModelUrl: null,
    scaledBoundingBoxMm: null,
    maxDimensionMm: null,
    status: "awaiting_payment",
    batchId: null,
    gridId: null,
    finishedModelUrl: null,
    wallThicknessMm: null,
    hasVentHole: false,
    ventHoleSource: null,
    paymentStatus: "unpaid",
    paidAt: null,
    stripeCheckoutSessionId: null,
  };

  const docRef = await addDoc(collection(db, "orders"), order);
  return docRef.id;
}
