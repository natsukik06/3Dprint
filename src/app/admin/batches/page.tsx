"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { getTotalQuantity } from "@/lib/pricing";
import type { ColorQuantities } from "@/types/order";

type BatchListItem = {
  id: string;
  totalCount: number;
  completedCount: number;
  completed: boolean;
  createdAt: { toDate: () => Date } | null;
};

// One pending order_item, grouped up into PendingOrderGroup below -- status=="pending" is exactly
// the set /api/admin/batches/generate's auto mode would also pick up (see that route's own query),
// so this list is literally "what the 自動生成 button would currently bundle, browsable by order".
type PendingItem = {
  id: string;
  orderId: string;
  customerName: string;
  subject: string;
  colorQuantities: ColorQuantities | undefined;
};

type PendingOrderGroup = {
  orderId: string;
  customerName: string;
  itemIds: string[];
  subjects: string[];
  quantity: number;
};

function groupPendingItems(items: PendingItem[]): PendingOrderGroup[] {
  const byOrder = new Map<string, PendingOrderGroup>();
  const order: PendingOrderGroup[] = [];
  for (const item of items) {
    let group = byOrder.get(item.orderId);
    if (!group) {
      group = { orderId: item.orderId, customerName: item.customerName, itemIds: [], subjects: [], quantity: 0 };
      byOrder.set(item.orderId, group);
      order.push(group);
    }
    group.itemIds.push(item.id);
    group.subjects.push(item.subject);
    group.quantity += Math.max(1, getTotalQuantity(item.colorQuantities as ColorQuantities));
  }
  return order;
}

function PendingOrdersSection({
  onBatchCreated,
}: {
  onBatchCreated: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingOrderGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPending(): Promise<PendingOrderGroup[]> {
    const snap = await getDocs(
      query(collection(db, "order_items"), where("status", "==", "pending"))
    );
    const items: PendingItem[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        orderId: data.orderId ?? "",
        customerName: data.customerName ?? "",
        subject: data.subject ?? "",
        colorQuantities: data.colorQuantities,
      };
    });
    return groupPendingItems(items);
  }

  useEffect(() => {
    fetchPending().then(setPending);
  }, []);

  function toggleOrder(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  async function generate(itemIds?: string[]) {
    if (!user) return;
    const setLoading = itemIds ? setManualGenerating : setAutoGenerating;
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/batches/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...(itemIds ? { "Content-Type": "application/json" } : {}),
        },
        ...(itemIds ? { body: JSON.stringify({ itemIds }) } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "バッチ生成に失敗しました");
      setSelected(new Set());
      setPending(await fetchPending());
      onBatchCreated();
      // Straight to the new batch's page, where "バッチ一式を同じフォルダに保存" (models + shipping
      // CSV + summary PDF) is the first thing on it -- so generating and exporting is one flow.
      if (typeof json.batchId === "string") router.push(`/admin/batches/${json.batchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "バッチ生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const selectedItemIds = (pending ?? [])
    .filter((g) => selected.has(g.orderId))
    .flatMap((g) => g.itemIds);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">未バッチの注文</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => generate(selectedItemIds)}
            disabled={selectedItemIds.length === 0 || manualGenerating}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {manualGenerating ? "作成中..." : `選択した注文でバッチを作成（${selected.size}件）`}
          </button>
          <button
            type="button"
            onClick={() => generate()}
            disabled={autoGenerating || (pending?.length ?? 0) === 0}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {autoGenerating ? "生成中..." : "新規バッチ生成（自動）"}
          </button>
        </div>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {pending === null ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500">未バッチの注文はありません</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {pending.map((group) => (
            <label
              key={group.orderId}
              className="flex cursor-pointer items-center gap-3 py-2"
            >
              <input
                type="checkbox"
                checked={selected.has(group.orderId)}
                onChange={() => toggleOrder(group.orderId)}
                className="h-4 w-4 shrink-0 accent-slate-800"
              />
              <span className="flex-1 text-sm text-slate-900">
                {group.customerName}様　{group.subjects.join(" / ")}
              </span>
              <span className="text-xs text-slate-500">{group.quantity}個</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function BatchListSection({ title, batches }: { title: string; batches: BatchListItem[] }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {title}（{batches.length}）
      </p>
      {batches.length === 0 ? (
        <p className="text-sm text-slate-500">バッチはありません</p>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/admin/batches/${batch.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">バッチ {batch.id}</p>
                <p className="text-xs text-slate-500">
                  {batch.createdAt?.toDate().toLocaleString("ja-JP") ?? ""}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {batch.completedCount}/{batch.totalCount} 完了
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BatchList() {
  const [batches, setBatches] = useState<BatchListItem[] | null>(null);

  async function fetchBatches(): Promise<BatchListItem[]> {
    const snap = await getDocs(
      query(collection(db, "print_batches"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        totalCount: data.totalCount ?? 0,
        completedCount: (data.completedCells ?? []).length,
        completed: data.completed === true,
        createdAt: data.createdAt ?? null,
      };
    });
  }

  useEffect(() => {
    fetchBatches().then(setBatches);
  }, []);

  return (
    <div className="space-y-4">
      <PendingOrdersSection onBatchCreated={() => fetchBatches().then(setBatches)} />
      {batches === null ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : (
        <>
          <BatchListSection
            title="進行中のバッチ"
            batches={batches.filter((b) => !b.completed)}
          />
          <BatchListSection
            title="完了したバッチ"
            batches={batches.filter((b) => b.completed)}
          />
        </>
      )}
    </div>
  );
}

export default function AdminBatchesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="mb-1 inline-block text-sm text-slate-600 underline underline-offset-2"
          >
            ← 注文一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-slate-900">印刷バッチ</h1>
        </div>
        <Link
          href="/admin/shipping"
          className="text-sm text-slate-600 underline underline-offset-2"
        >
          発送CSV
        </Link>
      </div>
      <BatchList />
    </main>
  );
}
