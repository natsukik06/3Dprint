"use client";

import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import JSZip from "jszip";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buildGridSequence } from "@/lib/batches";
import { db } from "@/lib/firebase";
import { PLATE_DEPTH_MM, PLATE_WIDTH_MM } from "@/lib/plateLayout";
import { waitForJob, type JobSnapshot } from "@/lib/watchJob";
import type { PrintBatchRecord } from "@/types/batch";
import styles from "./print.module.css";

type BatchState = (PrintBatchRecord & { id: string }) | null | undefined;
type PlateResult = {
  index: number;
  itemCount: number;
  items: { gridId: string; url: string }[];
};

function BatchGridDashboard({ id }: { id: string }) {
  const { user } = useAuth();
  const [batch, setBatch] = useState<BatchState>(undefined);
  const [printedAt] = useState(() => new Date());
  const gridSequence = useMemo(() => buildGridSequence(), []);
  const [plateResults, setPlateResults] = useState<PlateResult[] | null>(null);
  const [plateGenerating, setPlateGenerating] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateProgress, setPlateProgress] = useState<JobSnapshot | null>(null);
  const [zippingPlate, setZippingPlate] = useState<number | null>(null);

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

  async function handleGeneratePlateLayout() {
    if (!user) return;
    setPlateGenerating(true);
    setPlateError(null);
    setPlateProgress(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/batches/${id}/plate-layout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "プレート配置の予約に失敗しました");
      // The Cloud Function downloads/packs/writes every item's STL (can take a while for a full
      // batch); this just watches the job doc it updates until it finishes.
      const result = (await waitForJob(json.jobId as string, setPlateProgress)) as {
        plates: PlateResult[];
      };
      setPlateResults(result.plates);
    } catch (err) {
      setPlateError(err instanceof Error ? err.message : "プレート配置の生成に失敗しました");
    } finally {
      setPlateGenerating(false);
      setPlateProgress(null);
    }
  }

  async function handleDownloadPlateZip(plate: PlateResult) {
    setZippingPlate(plate.index);
    try {
      const zip = new JSZip();
      await Promise.all(
        plate.items.map(async (item) => {
          const res = await fetch(item.url);
          zip.file(`${item.gridId}.stl`, await res.arrayBuffer());
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch?.id ?? "batch"}-plate${plate.index}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZippingPlate(null);
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
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${styles.noPrint}`}>
        <Link
          href="/admin/batches"
          className="text-sm text-slate-600 underline underline-offset-2"
        >
          ← バッチ一覧に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {plateGenerating && plateProgress && (
            <p className="text-xs text-slate-500">
              {plateProgress.message ?? "処理中..."}（{plateProgress.progress}%）
            </p>
          )}
          <button
            type="button"
            onClick={handleGeneratePlateLayout}
            disabled={plateGenerating}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {plateGenerating ? "配置生成中..." : "プレート配置ファイルを生成"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            🖨️ 作業シートを印刷
          </button>
        </div>
      </div>

      {(plateError || plateResults) && (
        <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
          {plateError && <p className="text-sm text-red-600">{plateError}</p>}
          {plateResults && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">
                {PLATE_WIDTH_MM}×{PLATE_DEPTH_MM}mmプレートに自動配置しました（{plateResults.length}枚に分割）。各アイテムは配置座標を埋め込んだ個別STLです。同じプレートのファイルをすべてスライサーに読み込むと、この配置が再現されます。
              </p>
              {plateResults.map((plate) => (
                <div key={plate.index}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      プレート{plate.index}（{plate.itemCount}個）
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadPlateZip(plate)}
                      disabled={zippingPlate === plate.index}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {zippingPlate === plate.index
                        ? "まとめています..."
                        : "まとめてダウンロード(ZIP)"}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {plate.items.map((item) => (
                      <div
                        key={item.gridId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">{item.gridId}</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 underline underline-offset-2"
                        >
                          STLダウンロード
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <BatchGridDashboard id={params.id} />
    </main>
  );
}
