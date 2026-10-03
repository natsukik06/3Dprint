"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, POSE_LABELS } from "@/lib/pricing";
import {
  HARDWARE_COLOR_LABELS,
  ORDER_STATUS_LABELS,
  SIZE_LABELS,
  type MagicColor,
  type OrderItemRecord,
  type OrderStatus,
} from "@/types/order";

type SpecRow = OrderItemRecord & {
  id: string;
  orderNumber?: string;
};

function colorBreakdown(colorQuantities: OrderItemRecord["colorQuantities"]): string {
  return Object.entries(colorQuantities)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as MagicColor]}×${qty}`)
    .join("・");
}

// One printable/scannable row per order_item (= per "セットに追加" entry, which can itself cover
// several physical pieces across colorQuantities) -- built so the person actually making the
// pieces can see every spec that risks a mix-up (size, color, engraving text/font, hardware) in
// one glance instead of reopening each order's detail page one at a time.
function SpecRowCard({ row }: { row: SpecRow }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {row.subject}
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
            {SIZE_LABELS[row.sizeOption]}
          </span>
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            row.status === "completed"
              ? "bg-emerald-100 text-emerald-700"
              : row.status === "batched"
                ? "bg-sky-100 text-sky-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {ORDER_STATUS_LABELS[row.status as OrderStatus]}
        </span>
      </div>
      <p className="mb-1 text-xs text-slate-500">
        {row.orderNumber ?? row.orderId} ・ {row.customerName}
      </p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-slate-500">カラー：</dt>
          <dd className="inline">{colorBreakdown(row.colorQuantities) || "-"}</dd>
        </div>
        {row.subjectType !== "object" && (
          <div>
            <dt className="inline font-medium text-slate-500">ポーズ：</dt>
            <dd className="inline">{POSE_LABELS[row.pose]}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium text-slate-500">管理刻印：</dt>
          <dd className="inline">{row.initial}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-500">金具穴：</dt>
          <dd className="inline">
            {row.wantsHardware
              ? `${HARDWARE_COLOR_LABELS[row.hardwareColor]}${
                  row.chainPositionNote ? `（${row.chainPositionNote}）` : ""
                }`
              : "なし"}
          </dd>
        </div>
        {row.wantsEngraving && (
          <div className="sm:col-span-2 rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
            <dt className="inline font-semibold">名前刻印：</dt>
            <dd className="inline">
              「{row.engravingText}」（{row.engravingFont}）
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default function AdminSpecListPage() {
  const [rows, setRows] = useState<SpecRow[] | null>(null);
  const [hideCompleted, setHideCompleted] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [orderItemsSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, "order_items"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "orders")),
      ]);
      if (cancelled) return;

      const orderNumberById = new Map<string, string | undefined>();
      for (const d of ordersSnap.docs) {
        orderNumberById.set(d.id, (d.data() as { orderNumber?: string }).orderNumber);
      }

      setRows(
        orderItemsSnap.docs.map((d) => {
          const data = d.data() as OrderItemRecord;
          return { ...data, id: d.id, orderNumber: orderNumberById.get(data.orderId) };
        })
      );
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </main>
    );
  }

  const visible = hideCompleted ? rows.filter((r) => r.status !== "completed") : rows;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
      >
        ← 注文一覧に戻る
      </Link>
      <h1 className="mb-2 text-xl font-bold text-slate-900">製作仕様一覧</h1>
      <p className="mb-4 text-xs text-slate-500">
        サイズ・カラー・刻印・金具など、取り違えやすい項目を1点ずつ確認できます。
      </p>
      <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(e) => setHideCompleted(e.target.checked)}
          className="h-3.5 w-3.5 accent-slate-800"
        />
        完了済みを非表示にする
      </label>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">対象のアイテムはありません</p>
      ) : (
        <div className="space-y-2">
          {visible.map((row) => (
            <SpecRowCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </main>
  );
}
