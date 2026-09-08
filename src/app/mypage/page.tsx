"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { signInWithGoogle } from "@/lib/auth";
import { downloadFileAs, sanitizeFilenamePart } from "@/lib/downloadFile";
import { db } from "@/lib/firebase";
import { formatYen, getTotalQuantity } from "@/lib/pricing";
import type { OrderItemDraft, PaymentStatus } from "@/types/order";

// 3Dモデルの保存期間 -- 発送後の削除までの猶予日数（Cloud Functionsのcleanup​OldModelsと合わせる）。
const MODEL_RETENTION_DAYS_AFTER_SHIPPING = 7;

type MyOrder = {
  id: string;
  orderNumber?: string;
  items: OrderItemDraft[];
  estimatedPriceYen: number;
  createdAt: { toDate: () => Date } | null;
  paymentStatus: PaymentStatus;
  shipped: boolean;
  shippedAt: { toDate: () => Date } | null;
  modelsDeleted: boolean;
};

function OrderCard({ order }: { order: MyOrder }) {
  // Lazy-initialized once per mount (not ticking) -- a day-granularity countdown doesn't need
  // to update live, and calling Date.now() directly during render trips the purity lint rule.
  const [now] = useState(() => Date.now());
  const previewUrl = order.items
    .map((item) => Object.values(item.finishedPreviewUrls)[0])
    .find(Boolean);
  const subjectSummary = order.items.map((item) => item.subject).join(" / ");
  const totalQuantity = order.items.reduce(
    (sum, item) => sum + getTotalQuantity(item.colorQuantities),
    0
  );
  const downloadableModels = order.items
    .map((item, i) => ({ subject: item.subject, url: item.modelUrl, index: i }))
    .filter((m) => !!m.url);
  const displayNumber = order.orderNumber ?? order.id;

  let daysLeft: number | null = null;
  if (order.shipped && order.shippedAt && !order.modelsDeleted) {
    const deadline =
      order.shippedAt.toDate().getTime() +
      MODEL_RETENTION_DAYS_AFTER_SHIPPING * 24 * 60 * 60 * 1000;
    daysLeft = Math.max(0, Math.ceil((deadline - now) / (24 * 60 * 60 * 1000)));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={subjectSummary}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {subjectSummary || "(処理中)"}{" "}
            <span className="text-xs font-normal text-slate-400">×{totalQuantity}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {displayNumber}
            {order.createdAt ? ` ・ ${order.createdAt.toDate().toLocaleDateString("ja-JP")}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                order.paymentStatus === "paid"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {order.paymentStatus === "paid" ? "支払い済み" : "支払い待ち"}
            </span>
            {order.paymentStatus === "paid" && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  order.shipped ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {order.shipped
                  ? `発送済み${order.shippedAt ? `（${order.shippedAt.toDate().toLocaleDateString("ja-JP")}）` : ""}`
                  : "製作・発送準備中"}
              </span>
            )}
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">
          {formatYen(order.estimatedPriceYen)}
        </p>
      </div>

      {order.paymentStatus === "paid" && downloadableModels.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {order.modelsDeleted ? (
            <p className="text-[11px] text-slate-400">
              発送から{MODEL_RETENTION_DAYS_AFTER_SHIPPING}日経過したため、3Dモデルは削除されました。
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {downloadableModels.map((m) => (
                  <button
                    key={m.index}
                    type="button"
                    onClick={() =>
                      downloadFileAs(
                        m.url!,
                        `${displayNumber}-${sanitizeFilenamePart(m.subject || `モデル${m.index + 1}`)}.glb`
                      ).catch((err) => {
                        console.error("model download failed", err);
                        alert("ダウンロードに失敗しました。もう一度お試しください。");
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    ⬇ {m.subject || `モデル${m.index + 1}`}をダウンロード
                  </button>
                ))}
              </div>
              {daysLeft !== null && (
                <p className="mt-1.5 text-[11px] text-amber-600">
                  発送から{MODEL_RETENTION_DAYS_AFTER_SHIPPING}日で3Dモデルは自動的に削除されます（残り{daysLeft}日）。保存したい場合は今のうちにダウンロードしてください。
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OrderHistory({ email }: { email: string }) {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "orders"),
            where("customerEmail", "==", email),
            orderBy("createdAt", "desc")
          )
        );
        if (cancelled) return;
        setOrders(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              orderNumber: data.orderNumber,
              items: (data.items ?? []) as OrderItemDraft[],
              estimatedPriceYen: data.estimatedPriceYen ?? 0,
              createdAt: data.createdAt ?? null,
              paymentStatus: (data.paymentStatus ?? "unpaid") as PaymentStatus,
              shipped: data.shipped ?? false,
              shippedAt: data.shippedAt ?? null,
              modelsDeleted: data.modelsDeleted ?? false,
            };
          })
        );
      } catch {
        if (!cancelled) setError("注文履歴の取得に失敗しました");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [email]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (orders === null) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }
  if (orders.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        まだ注文履歴がありません（支払い完了後にここに表示されます）。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export default function MyPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <Link
          href="/order"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          注文ページに戻る
        </Link>
        <header className="mb-6 text-center">
          <h1 className="mx-auto">
            <Image
              src="/logo-full.png"
              alt="LUMINA CHARO"
              width={1569}
              height={1034}
              className="mx-auto h-auto w-40"
            />
          </h1>
          <p className="mt-2 text-lg font-bold text-slate-900">マイページ</p>
          <p className="mt-1 text-sm text-slate-600">購入履歴・発送状況を確認できます</p>
        </header>

        <p className="mb-4 rounded-lg bg-amber-50 p-2.5 text-center text-[11px] text-amber-700">
          3Dモデルのデータは、商品発送から{MODEL_RETENTION_DAYS_AFTER_SHIPPING}
          日後に自動的に削除されます。保存しておきたい方は、発送後お早めにこのページからダウンロードしてください。
        </p>

        {isLoading ? null : !user ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="mb-4 text-sm text-slate-600">
              ログインすると、ご自身の注文履歴・発送状況を確認できます
            </p>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Googleでログイン
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">{user.email}でログイン中</p>
            <OrderHistory email={user.email ?? ""} />
          </>
        )}
      </main>
    </div>
  );
}
