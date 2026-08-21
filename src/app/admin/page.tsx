"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { db } from "@/lib/firebase";
import { formatYen, getTotalQuantity } from "@/lib/pricing";
import type { OrderItemDraft, PaymentStatus } from "@/types/order";

type OrderListItem = {
  id: string;
  items: OrderItemDraft[];
  customerName: string;
  estimatedPriceYen: number;
  createdAt: { toDate: () => Date } | null;
  paymentStatus: PaymentStatus;
};

function AdminOrderList() {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"))
      );
      if (cancelled) return;
      setOrders(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            items: (data.items ?? []) as OrderItemDraft[],
            customerName: data.customerName ?? "",
            estimatedPriceYen: data.estimatedPriceYen ?? 0,
            createdAt: data.createdAt ?? null,
            paymentStatus: (data.paymentStatus ?? "unpaid") as PaymentStatus,
          };
        })
      );
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (orders === null) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }
  if (orders.length === 0) {
    return <p className="text-sm text-slate-500">注文はまだありません</p>;
  }

  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {orders.map((order) => {
        const previewUrl = order.items
          .map((item) => Object.values(item.finishedPreviewUrls)[0])
          .find(Boolean);
        const subjectSummary = order.items.map((item) => item.subject).join(" / ");
        const totalQuantity = order.items.reduce(
          (sum, item) => sum + getTotalQuantity(item.colorQuantities),
          0
        );

        return (
          <Link
            key={order.id}
            href={`/admin/orders/${order.id}`}
            className="flex items-center gap-3 p-3 hover:bg-slate-50"
          >
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
                {subjectSummary || "(未設定)"}{" "}
                <span className="text-xs font-normal text-slate-400">
                  ×{totalQuantity}
                </span>
                <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">
                  {order.items.length}点セット
                </span>
                <span
                  className={`ml-1 rounded px-1 text-[10px] ${
                    order.paymentStatus === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {order.paymentStatus === "paid" ? "支払い済み" : "支払い待ち"}
                </span>
              </p>
              <p className="truncate text-xs text-slate-500">
                {order.customerName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-slate-900">
                {formatYen(order.estimatedPriceYen)}
              </p>
              {order.createdAt && (
                <p className="text-xs text-slate-400">
                  {order.createdAt.toDate().toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">注文一覧</h1>
            <div className="flex gap-3 text-sm">
              <Link
                href="/admin/batches"
                className="text-slate-600 underline underline-offset-2"
              >
                印刷バッチ
              </Link>
              <Link
                href="/admin/shipping"
                className="text-slate-600 underline underline-offset-2"
              >
                発送CSV
              </Link>
              <Link
                href="/admin/marketing"
                className="text-slate-600 underline underline-offset-2"
              >
                お知らせメール
              </Link>
            </div>
          </div>
          <AdminOrderList />
        </main>
      </div>
    </AdminGate>
  );
}
