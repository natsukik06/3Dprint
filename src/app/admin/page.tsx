"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, formatYen, getTotalQuantity } from "@/lib/pricing";
import {
  MAGIC_COLOR_OPTIONS,
  ORDER_STATUS_LABELS,
  type ColorQuantities,
  type MagicColor,
  type OrderStatus,
  type SizeOption,
} from "@/types/order";

type OrderListItem = {
  id: string;
  subject: string;
  colorQuantities: ColorQuantities;
  customerName: string;
  estimatedPriceYen: number;
  finishedPreviewUrls: Partial<Record<MagicColor, string>>;
  createdAt: { toDate: () => Date } | null;
  sizeOption: SizeOption | null;
  status: OrderStatus;
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
            subject: data.subject,
            colorQuantities: data.colorQuantities ?? {
              starryBlue: 0,
              galaxyGreen: 0,
              clearAurora: 0,
            },
            customerName: data.customerName,
            estimatedPriceYen: data.estimatedPriceYen,
            finishedPreviewUrls: data.finishedPreviewUrls ?? {},
            createdAt: data.createdAt ?? null,
            sizeOption: data.sizeOption ?? null,
            status: (data.status ?? "pending") as OrderStatus,
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
        const previewUrl = Object.values(order.finishedPreviewUrls)[0];
        const colorSummary = MAGIC_COLOR_OPTIONS.filter(
          (c) => (order.colorQuantities[c] ?? 0) > 0
        )
          .map((c) => `${MAGIC_COLOR_LABELS[c]}×${order.colorQuantities[c]}`)
          .join(" / ");

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
                  alt={order.subject}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {order.subject}{" "}
                <span className="text-xs font-normal text-slate-400">
                  ×{getTotalQuantity(order.colorQuantities)}
                </span>
                {order.sizeOption && (
                  <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
                    {order.sizeOption}
                  </span>
                )}
                <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </p>
              <p className="truncate text-xs text-slate-500">
                {order.customerName} ・ {colorSummary}
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
            </div>
          </div>
          <AdminOrderList />
        </main>
      </div>
    </AdminGate>
  );
}
