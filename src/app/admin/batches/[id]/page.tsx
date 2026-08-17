"use client";

import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { buildGridSequence } from "@/lib/batches";
import { db } from "@/lib/firebase";
import type { PrintBatchRecord } from "@/types/batch";
import styles from "./print.module.css";

type BatchState = (PrintBatchRecord & { id: string }) | null | undefined;

function BatchGridDashboard({ id }: { id: string }) {
  const [batch, setBatch] = useState<BatchState>(undefined);
  const [printedAt] = useState(() => new Date());
  const gridSequence = useMemo(() => buildGridSequence(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const snap = await getDoc(doc(db, "print_batches", id));
      if (cancelled) return;
      if (!snap.exists()) {
        setBatch(null);
        return;
      }
      const data = snap.data();
      setBatch({
        id: snap.id,
        entries: data.entries ?? [],
        totalCount: data.totalCount ?? 0,
        completedCells: data.completedCells ?? [],
        createdAt: data.createdAt ?? null,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleCell(gridId: string) {
    if (!batch) return;
    const isCompleted = batch.completedCells.includes(gridId);
    const nextCompleted = isCompleted
      ? batch.completedCells.filter((g) => g !== gridId)
      : [...batch.completedCells, gridId];
    setBatch({ ...batch, completedCells: nextCompleted });
    try {
      await updateDoc(doc(db, "print_batches", id), {
        completedCells: isCompleted ? arrayRemove(gridId) : arrayUnion(gridId),
      });
    } catch (error) {
      console.error("failed to toggle cell", error);
    }
  }

  if (batch === undefined) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }
  if (batch === null) {
    return <p className="text-sm text-slate-500">バッチが見つかりません</p>;
  }

  const entryByGridId = new Map(batch.entries.map((e) => [e.gridId, e]));

  return (
    <div className={styles.page}>
      <div className={`mb-4 flex items-center justify-between gap-3 ${styles.noPrint}`}>
        <Link
          href="/admin/batches"
          className="text-sm text-slate-600 underline underline-offset-2"
        >
          ← バッチ一覧に戻る
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          🖨️ 作業シートを印刷
        </button>
      </div>

      <div className={styles.sheet}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-2">
          <h1 className="text-lg font-bold text-slate-900">
            バッチID: {batch.id}
          </h1>
          <p className="text-sm text-slate-600">
            印刷日時: {printedAt.toLocaleString("ja-JP")}
          </p>
          <p className="text-sm text-slate-600">合計個数: {batch.totalCount}個</p>
        </div>

        <div className={styles.grid}>
          {gridSequence.map((gridId) => {
            const entry = entryByGridId.get(gridId);
            const isCompleted = batch.completedCells.includes(gridId);
            const cellClass = !entry
              ? `${styles.cell} ${styles.cellEmpty}`
              : isCompleted
                ? `${styles.cell} ${styles.cellCompleted}`
                : styles.cell;

            return (
              <div
                key={gridId}
                className={cellClass}
                onClick={entry ? () => toggleCell(gridId) : undefined}
              >
                {isCompleted && <span className={styles.checkmark}>✓</span>}
                <p className={styles.gridId}>{gridId}</p>
                {entry ? (
                  <>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-900">
                      {entry.customerName}
                      <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
                        {entry.sizeOption}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-slate-600">
                      {entry.subject}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {entry.colorSummary}
                    </p>
                    <p className={`mt-1 ${styles.checkbox}`}>
                      □洗 □注 □塗 □箱
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[11px]">未配置</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminBatchDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <BatchGridDashboard id={params.id} />
        </main>
      </div>
    </AdminGate>
  );
}
