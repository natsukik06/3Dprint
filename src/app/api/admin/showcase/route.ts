import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { SHOWCASE_COLLECTION, storagePathFromUrl, storagePublicUrl, toAdminItem } from "@/lib/showcase";
import type { ShowcaseCandidate } from "@/types/showcase";

type OrderItemLite = {
  modelUrl?: unknown;
  referenceImageUrls?: unknown;
  finishedPreviewUrls?: unknown;
};

function firstString(values: unknown): string | null {
  if (Array.isArray(values)) {
    const v = values.find((x) => typeof x === "string" && x);
    return typeof v === "string" ? v : null;
  }
  if (values && typeof values === "object") {
    const v = Object.values(values as Record<string, unknown>).find((x) => typeof x === "string" && x);
    return typeof v === "string" ? v : null;
  }
  return null;
}

// 一覧: 作成例(下書き+公開)と、「作成例に追加」できる候補(掲載の許可あり・支払い済みの注文の1点ごと)。
// 氏名・住所・メール・電話は返さない。
export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  try {
    const [itemsSnap, ordersSnap] = await Promise.all([
      adminDb.collection(SHOWCASE_COLLECTION).get(),
      adminDb
        .collection("orders")
        .where("agreeShowcase", "==", true)
        .where("paymentStatus", "==", "paid")
        .get(),
    ]);

    const items = itemsSnap.docs
      .map((d) => toAdminItem(d.id, d.data()))
      .sort((a, b) => a.order - b.order || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    const addedIds = new Set(items.map((i) => i.id));

    const candidates: ShowcaseCandidate[] = [];
    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data();
      const orderItems = (Array.isArray(data.items) ? data.items : []) as OrderItemLite[];
      orderItems.forEach((item, itemIndex) => {
        if (typeof item.modelUrl !== "string" || !item.modelUrl) return;
        candidates.push({
          orderId: orderDoc.id,
          orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null,
          itemIndex,
          previewUrl: firstString(item.finishedPreviewUrls) ?? firstString(item.referenceImageUrls),
          hasCustomerImage: !!firstString(item.referenceImageUrls),
          added: addedIds.has(`${orderDoc.id}_${itemIndex}`),
        });
      });
    }
    candidates.sort((a, b) => (b.orderNumber ?? b.orderId).localeCompare(a.orderNumber ?? a.orderId));

    return NextResponse.json({ items, candidates });
  } catch (error) {
    console.error("showcase list failed", error);
    return NextResponse.json({ error: "読み込みに失敗しました" }, { status: 500 });
  }
}

// 作成例に追加(下書きとして作成)。3Dモデルは発送後に消える models/ から showcase/<id>/ へコピーする。
export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });

  try {
    const body = (await request.json()) as {
      orderId?: unknown;
      itemIndex?: unknown;
      useCustomerImage?: unknown;
    };
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const itemIndex = Number(body.itemIndex);
    if (!orderId || !Number.isInteger(itemIndex) || itemIndex < 0) {
      return NextResponse.json({ error: "注文の指定が正しくありません" }, { status: 400 });
    }

    const orderSnap = await adminDb.collection("orders").doc(orderId).get();
    const order = orderSnap.data();
    if (!order || order.paymentStatus !== "paid") {
      return NextResponse.json({ error: "支払い済みの注文が見つかりません" }, { status: 404 });
    }
    if (order.agreeShowcase !== true) {
      return NextResponse.json({ error: "この注文は掲載の許可がありません" }, { status: 403 });
    }
    const orderItem = (Array.isArray(order.items) ? order.items : [])[itemIndex] as OrderItemLite | undefined;
    if (!orderItem || typeof orderItem.modelUrl !== "string") {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const id = `${orderId}_${itemIndex}`;
    const docRef = adminDb.collection(SHOWCASE_COLLECTION).doc(id);
    if ((await docRef.get()).exists) {
      return NextResponse.json({ error: "すでに追加されています" }, { status: 409 });
    }

    const bucket = adminStorage.bucket();
    const modelSrc = storagePathFromUrl(orderItem.modelUrl, bucket.name);
    if (!modelSrc || !(modelSrc.startsWith("models/") || modelSrc.startsWith("custom-models/"))) {
      return NextResponse.json({ error: "3Dモデルの保存場所を確認できません" }, { status: 422 });
    }
    const modelFile = bucket.file(modelSrc);
    if (!(await modelFile.exists())[0]) {
      return NextResponse.json(
        { error: "3Dモデルのファイルがすでに削除されています(発送後7日で消えます)" },
        { status: 410 }
      );
    }
    const modelDest = `showcase/${id}/model.glb`;
    await modelFile.copy(bucket.file(modelDest));

    let customerImageUrl: string | null = null;
    let customerImagePath: string | null = null;
    if (body.useCustomerImage === true) {
      const refUrl = firstString(orderItem.referenceImageUrls);
      const refSrc = refUrl ? storagePathFromUrl(refUrl, bucket.name) : null;
      if (refSrc && refSrc.startsWith("orders/") && (await bucket.file(refSrc).exists())[0]) {
        const ext = (refSrc.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
        customerImagePath = `showcase/${id}/customer.${ext}`;
        await bucket.file(refSrc).copy(bucket.file(customerImagePath));
        customerImageUrl = storagePublicUrl(bucket.name, customerImagePath);
      }
    }

    await docRef.set({
      orderId,
      orderNumber: typeof order.orderNumber === "string" ? order.orderNumber : null,
      itemIndex,
      title: "",
      caption: "",
      modelUrl: storagePublicUrl(bucket.name, modelDest),
      customerImageUrl,
      photoUrl: null,
      showOnHome: false,
      published: false,
      order: 100,
      createdAt: FieldValue.serverTimestamp(),
      publishedAt: null,
    });

    return NextResponse.json({ id, customerImageCopied: !!customerImageUrl });
  } catch (error) {
    console.error("showcase create failed", error);
    return NextResponse.json({ error: "追加に失敗しました" }, { status: 500 });
  }
}
