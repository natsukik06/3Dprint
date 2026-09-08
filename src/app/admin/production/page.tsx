"use client";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { getTotalQuantity } from "@/lib/pricing";
import type { OrderItemDraft, OrderItemRecord, PaymentStatus } from "@/types/order";

type ProductionOrder = {
  id: string;
  orderNumber?: string;
  items: OrderItemDraft[];
  customerName: string;
  createdAt: { toDate: () => Date } | null;
  paymentStatus: PaymentStatus;
  insertPrinted: boolean;
  printed: boolean;
  printedAt: { toDate: () => Date } | null;
  shipped: boolean;
  shippedAt: { toDate: () => Date } | null;
};

// Auto-derived from order_items -- this app already tracks these facts (scaledModelUrl,
// finishedModelUrl, batchId), so re-deriving them here beats adding yet another manual checkbox
// that could drift from reality. Only the steps nothing in the pipeline can observe on its own
// (actually printed, actually shipped) are manual toggles.
type AutoStage = "modelDone" | "hollowDone" | "batchedDone";

function deriveAutoStages(items: OrderItemRecord[]): Record<AutoStage, boolean> {
  if (items.length === 0) {
    return { modelDone: false, hollowDone: false, batchedDone: false };
  }
  return {
    modelDone: items.every((i) => !!i.scaledModelUrl),
    hollowDone: items.every((i) => !!i.finishedModelUrl),
    batchedDone: items.every((i) => !!i.batchId),
  };
}

function StageDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
      }`}
    >
      {done ? "✓" : "・"} {label}
    </span>
  );
}

function ManualToggle({
  done,
  doneAt,
  label,
  onToggle,
}: {
  done: boolean;
  doneAt: { toDate: () => Date } | null;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={done && doneAt ? doneAt.toDate().toLocaleString("ja-JP") : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        done
          ? "border-sky-200 bg-sky-100 text-sky-700"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {done ? "✓" : "○"} {label}
    </button>
  );
}

function ProductionRow({
  order,
  items,
  onUpdate,
}: {
  order: ProductionOrder;
  items: OrderItemRecord[];
  onUpdate: (patch: Partial<ProductionOrder>) => void;
}) {
  const auto = deriveAutoStages(items);
  const subjectSummary = order.items.map((i) => i.subject).join(" / ");
  const totalQuantity = order.items.reduce(
    (sum, i) => sum + getTotalQuantity(i.colorQuantities),
    0
  );

  async function toggle(field: "printed" | "shipped") {
    const next = !order[field];
    onUpdate({ [field]: next, [`${field}At`]: null } as Partial<ProductionOrder>);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        [field]: next,
        [`${field}At`]: next ? serverTimestamp() : null,
      });
    } catch (error) {
      console.error(`failed to toggle ${field}`, error);
      onUpdate({ [field]: !next } as Partial<ProductionOrder>);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/orders/${order.id}`}
            className="truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
          >
            {subjectSummary || "(未設定)"} <span className="text-xs text-slate-400">×{totalQuantity}</span>
          </Link>
          <p className="truncate text-xs text-slate-500">
            {order.orderNumber ?? order.id} ・ {order.customerName} ・{" "}
            {order.createdAt ? order.createdAt.toDate().toLocaleDateString("ja-JP") : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StageDot done label="支払い済み" />
        <StageDot done={auto.modelDone} label="3Dモデル生成" />
        <StageDot done={auto.hollowDone} label="中空化・穴あけ" />
        <StageDot done={auto.batchedDone} label="バッチ配置" />
        <ManualToggle
          done={order.printed}
          doneAt={order.printedAt}
          label="印刷完了"
          onToggle={() => toggle("printed")}
        />
        <ManualToggle
          done={order.shipped}
          doneAt={order.shippedAt}
          label="発送済み"
          onToggle={() => toggle("shipped")}
        />
      </div>
    </div>
  );
}

function ProductionTracker() {
  const [orders, setOrders] = useState<ProductionOrder[] | null>(null);
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItemRecord[]>>({});
  const [hideShipped, setHideShipped] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("paymentStatus", "==", "paid"),
          orderBy("createdAt", "desc")
        )
      );
      if (cancelled) return;
      const loaded: ProductionOrder[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          orderNumber: data.orderNumber,
          items: (data.items ?? []) as OrderItemDraft[],
          customerName: data.customerName ?? "",
          createdAt: data.createdAt ?? null,
          paymentStatus: (data.paymentStatus ?? "unpaid") as PaymentStatus,
          insertPrinted: data.insertPrinted ?? false,
          printed: data.printed ?? false,
          printedAt: data.printedAt ?? null,
          shipped: data.shipped ?? false,
          shippedAt: data.shippedAt ?? null,
        };
      });
      setOrders(loaded);

      const itemsSnap = await getDocs(collection(db, "order_items"));
      if (cancelled) return;
      const byOrder: Record<string, OrderItemRecord[]> = {};
      for (const itemDoc of itemsSnap.docs) {
        const data = itemDoc.data() as OrderItemRecord;
        const list = byOrder[data.orderId] ?? [];
        list.push({ ...data, id: itemDoc.id } as OrderItemRecord & { id: string });
        byOrder[data.orderId] = list;
      }
      setItemsByOrderId(byOrder);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (orders === null) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }

  const visible = hideShipped ? orders.filter((o) => !o.shipped) : orders;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={hideShipped}
          onChange={(e) => setHideShipped(e.target.checked)}
          className="h-3.5 w-3.5 accent-slate-800"
        />
        発送済みを非表示にする
      </label>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">対象の注文はありません</p>
      ) : (
        visible.map((order) => (
          <ProductionRow
            key={order.id}
            order={order}
            items={itemsByOrderId[order.id] ?? []}
            onUpdate={(patch) =>
              setOrders((prev) =>
                prev?.map((o) => (o.id === order.id ? { ...o, ...patch } : o)) ?? prev
              )
            }
          />
        ))
      )}
    </div>
  );
}

export default function AdminProductionPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
      >
        ← 注文一覧に戻る
      </Link>
      <h1 className="mb-2 text-xl font-bold text-slate-900">製作・発送の進捗</h1>
      <p className="mb-6 text-xs text-slate-500">
        3Dモデル生成・中空化・バッチ配置は自動で判定されます。印刷完了・発送済みは自分でタップして記録してください。
      </p>
      <ProductionTracker />
    </main>
  );
}
