"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { db } from "@/lib/firebase";
import { downloadCsv, toCsv } from "@/lib/csv";
import { DELIVERY_TIME_SLOT_LABELS } from "@/lib/pricing";
import {
  SHIPPING_METHOD_BY_SIZE,
  type DeliveryTimeSlot,
  type OrderItemDraft,
} from "@/types/order";

const CSV_HEADERS = [
  "注文ID",
  "お客様名",
  "郵便番号",
  "住所",
  "電話番号",
  "配送希望日",
  "配送希望時間帯",
  "セット内容",
  "サイズ",
  "配送方法",
];

const SHIPPING_METHODS = Array.from(new Set(Object.values(SHIPPING_METHOD_BY_SIZE)));

function ShippingExportButton({ method }: { method: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), where("shippingMethod", "==", method))
      );
      const rows = snap.docs.map((d) => {
        const data = d.data();
        const items = (data.items ?? []) as OrderItemDraft[];
        return [
          d.id,
          data.customerName ?? "",
          data.postalCode ?? "",
          data.address ?? "",
          data.phoneNumber ?? "",
          data.deliveryDate ?? "",
          DELIVERY_TIME_SLOT_LABELS[(data.deliveryTimeSlot ?? "none") as DeliveryTimeSlot],
          items.map((item) => item.subject).join(" / "),
          items.map((item) => item.sizeOption).join(" / "),
          method,
        ];
      });
      downloadCsv(`shipping-${method}-${Date.now()}.csv`, toCsv(CSV_HEADERS, rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV出力に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-slate-900">{method}</p>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? "出力中..." : "CSVダウンロード"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function AdminShippingPage() {
  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <Link
            href="/admin"
            className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
          >
            ← 注文一覧に戻る
          </Link>
          <h1 className="mb-6 text-xl font-bold text-slate-900">発送CSV</h1>
          <div className="space-y-3">
            {SHIPPING_METHODS.map((method) => (
              <ShippingExportButton key={method} method={method} />
            ))}
          </div>
        </main>
      </div>
    </AdminGate>
  );
}
