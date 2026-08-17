"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";

type BatchListItem = {
  id: string;
  totalCount: number;
  completedCount: number;
  createdAt: { toDate: () => Date } | null;
};

function BatchList() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BatchListItem[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        createdAt: data.createdAt ?? null,
      };
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetchBatches().then((result) => {
      if (!cancelled) setBatches(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/batches/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "バッチ生成に失敗しました");
      setBatches(await fetchBatches());
    } catch (err) {
      setError(err instanceof Error ? err.message : "バッチ生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {generating ? "生成中..." : "新規バッチ生成"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {batches === null ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-slate-500">バッチはまだありません</p>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/admin/batches/${batch.id}`}
              className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  バッチ {batch.id}
                </p>
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

export default function AdminBatchesPage() {
  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
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
      </div>
    </AdminGate>
  );
}
