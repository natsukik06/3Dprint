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
import { estimateRemaining } from "@/lib/eta";
import type { PrintBatchRecord } from "@/types/batch";
import styles from "./print.module.css";

// Matches DEFAULT_WALL_THICKNESS_MM / DEFAULT_SPHERE_SEGMENTS in the finish-mesh API route and
// the individual order-item page -- same one-time hollow settings, just triggered here for a
// whole batch at once instead of one order at a time.
const DEFAULT_WALL_THICKNESS_MM = 0.8;
const DEFAULT_SPHERE_SEGMENTS = 32;
const DEFAULT_HOLE_DIAMETER_MM = 2;

type HoleSetting = { x: number; z: number; diameterMm: number };

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
  const [plateStartedAt, setPlateStartedAt] = useState<number | null>(null);
  const [zippingPlate, setZippingPlate] = useState<number | null>(null);

  // Per-item drain-hole position (0-1 fraction of that item's own footprint, same convention as
  // print-pipeline's HOLE_X/HOLE_Y) -- keyed by itemId, editable per row below before running the
  // bulk hollow step, so a whole batch's worth of items can be positioned in one pass instead of
  // visiting each order's own detail page.
  const [holeSettings, setHoleSettings] = useState<Record<string, HoleSetting>>({});
  // For admins who'd rather hollow/hole/support the models themselves (their own Blender/
  // PrusaSlicer setup -- see print-pipeline/) instead of running this app's own Cloud Function.
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [rawDownloadError, setRawDownloadError] = useState<string | null>(null);
  const [uploadingFinished, setUploadingFinished] = useState(false);
  const [uploadResults, setUploadResults] = useState<Record<string, string>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<{ done: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  // Live progress of whichever item the bulk loop is currently hollowing, plus when that one
  // item's job started -- lets the ETA readout answer "how long does one of these actually take",
  // same as the single-item finish-mesh page.
  const [bulkItemProgress, setBulkItemProgress] = useState<JobSnapshot | null>(null);
  const [bulkItemStartedAt, setBulkItemStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!bulkRunning && !plateGenerating) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [bulkRunning, plateGenerating]);

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
      const entries = (data.entries ?? []) as PrintBatchRecord["entries"];
      setBatch({
        id: snap.id,
        entries,
        totalCount: data.totalCount ?? 0,
        completedCells: data.completedCells ?? [],
        createdAt: data.createdAt ?? null,
      });
      setHoleSettings((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          if (!next[entry.itemId]) {
            next[entry.itemId] = {
              x: 0.5,
              z: 0.5,
              diameterMm: DEFAULT_HOLE_DIAMETER_MM,
            };
          }
        }
        return next;
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

  function updateHoleSetting(itemId: string, patch: Partial<HoleSetting>) {
    setHoleSettings((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  }

  // Runs "中空化・穴あけ" once per unique DESIGN in the batch (not once per grid cell) -- an
  // order_item occupying several cells (quantity > 1 in colorQuantities) is the same STL hollowed
  // once, then physically duplicated at plate-layout time, so re-running this per cell would just
  // redo identical (slow) work N times for nothing. Sequential (not Promise.all) so the progress
  // readout stays simple and honest, and so one runaway job can't pile up concurrent Cloud
  // Function invocations. Errors on individual items are collected rather than aborting the whole
  // run -- a bad item shouldn't block the rest.
  async function handleBulkFinishMesh() {
    if (!user || !batch) return;
    const uniqueItemIds = [...new Set(batch.entries.map((e) => e.itemId))];
    setBulkRunning(true);
    setBulkErrors({});
    setBulkStatus({ done: 0, total: uniqueItemIds.length });
    try {
      const idToken = await user.getIdToken();
      for (let i = 0; i < uniqueItemIds.length; i++) {
        const itemId = uniqueItemIds[i];
        const hole = holeSettings[itemId] ?? {
          x: 0.5,
          z: 0.5,
          diameterMm: DEFAULT_HOLE_DIAMETER_MM,
        };
        setBulkItemProgress(null);
        setBulkItemStartedAt(Date.now());
        try {
          const res = await fetch(`/api/admin/order-items/${itemId}/finish-mesh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
              sphereSegments: DEFAULT_SPHERE_SEGMENTS,
              bottomHoleXFraction: hole.x,
              bottomHoleZFraction: hole.z,
              bottomHoleDiameterMm: hole.diameterMm,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "処理の予約に失敗しました");
          await waitForJob(json.jobId as string, setBulkItemProgress);
        } catch (err) {
          setBulkErrors((prev) => ({
            ...prev,
            [itemId]: err instanceof Error ? err.message : "処理に失敗しました",
          }));
        }
        setBulkStatus({ done: i + 1, total: uniqueItemIds.length });
      }
    } finally {
      setBulkRunning(false);
      setBulkItemProgress(null);
      setBulkItemStartedAt(null);
    }
  }

  // Downloads one plain STL per unique design (pre-hollow) as a zip, so the admin can run their
  // own local pipeline on them instead of this app's Cloud Function. One file per itemId, not per
  // grid cell -- a quantity > 1 design only needs hollowing once (see uniqueEntries above); the
  // same finished file gets reused for all of its duplicate cells automatically at plate-layout
  // time.
  async function handleDownloadRawZip() {
    if (!user || !batch) return;
    setDownloadingRaw(true);
    setRawDownloadError(null);
    try {
      const idToken = await user.getIdToken();
      const zip = new JSZip();
      await Promise.all(
        uniqueEntries.map(async (entry) => {
          const res = await fetch(`/api/admin/order-items/${entry.itemId}/raw-stl`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? `${entry.itemId}のダウンロードに失敗しました`);
          }
          zip.file(`${entry.itemId}.stl`, await res.arrayBuffer());
          // Per-item drain-hole position, from the same X/Z fields used by the bulk
          // Cloud-Function flow above -- a fixed position applied to every item in the
          // batch would land in a bad spot (a leg, an ear, too-thin a wall) on anything
          // but a symmetric shape, so hollow_batch.bat reads this back per file instead
          // of using one hardcoded position for the whole folder.
          const hole = holeSettings[entry.itemId] ?? {
            x: 0.5,
            z: 0.5,
            diameterMm: DEFAULT_HOLE_DIAMETER_MM,
          };
          zip.file(`${entry.itemId}.hole.txt`, `${hole.x} ${hole.z} ${hole.diameterMm}`);
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch.id}-raw.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRawDownloadError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      setDownloadingRaw(false);
    }
  }

  // Matches each selected file back to a design by its filename (must be "<itemId>.stl", exactly
  // what handleDownloadRawZip's zip contains) and uploads it as that item's finished model --
  // skips this app's own hollow/hole Cloud Function entirely. Files that don't match any item in
  // this batch are reported as errors rather than silently ignored.
  async function handleUploadFinishedFiles(files: FileList) {
    if (!user || !batch) return;
    const validItemIds = new Set(uniqueEntries.map((e) => e.itemId));
    setUploadingFinished(true);
    setUploadResults({});
    try {
      const idToken = await user.getIdToken();
      const results: Record<string, string> = {};
      for (const file of Array.from(files)) {
        const itemId = file.name.replace(/\.stl$/i, "");
        if (!validItemIds.has(itemId)) {
          results[file.name] = "このバッチのアイテムと一致しません（ファイル名を確認してください）";
          continue;
        }
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/admin/order-items/${itemId}/upload-finished`, {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
            body: form,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "アップロードに失敗しました");
          results[itemId] = "✓ 完了";
        } catch (err) {
          results[itemId] = err instanceof Error ? err.message : "アップロードに失敗しました";
        }
        setUploadResults({ ...results });
      }
    } finally {
      setUploadingFinished(false);
    }
  }

  async function handleGeneratePlateLayout() {
    if (!user) return;
    setPlateGenerating(true);
    setPlateError(null);
    setPlateProgress(null);
    setPlateStartedAt(Date.now());
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
  // One row per DESIGN for the hole-position list below, not one per grid cell -- a quantity > 1
  // item hollows once and shares that same position across all of its duplicate cells.
  const uniqueEntries = batch.entries.filter(
    (e, i) => batch.entries.findIndex((other) => other.itemId === e.itemId) === i
  );
  const gridIdsByItemId = new Map<string, string[]>();
  for (const e of batch.entries) {
    gridIdsByItemId.set(e.itemId, [...(gridIdsByItemId.get(e.itemId) ?? []), e.gridId]);
  }

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
              {plateProgress.message ?? "処理中..."}（{plateProgress.progress}%
              {plateStartedAt && (() => {
                const eta = estimateRemaining(plateStartedAt, plateProgress.progress, nowTick);
                return (
                  <>
                    ・経過{eta.elapsedLabel}
                    {eta.remainingLabel && `・残り約${eta.remainingLabel}`}
                  </>
                );
              })()}
              ）
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

      <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            中空化・穴あけ（水抜き穴位置を指定して一括実行）
          </p>
          <div className="flex items-center gap-2">
            {bulkRunning && bulkStatus && (
              <p className="text-xs text-slate-500">
                {bulkStatus.done}/{bulkStatus.total} 件処理中
                {bulkItemProgress && `（この1件: ${bulkItemProgress.message ?? "処理中..."} ${bulkItemProgress.progress}%`}
                {bulkItemProgress && bulkItemStartedAt && (() => {
                  const eta = estimateRemaining(
                    bulkItemStartedAt,
                    bulkItemProgress.progress,
                    nowTick
                  );
                  return (
                    <>
                      ・経過{eta.elapsedLabel}
                      {eta.remainingLabel && `・残り約${eta.remainingLabel}`}
                    </>
                  );
                })()}
                {bulkItemProgress && "）"}
              </p>
            )}
            <button
              type="button"
              onClick={handleBulkFinishMesh}
              disabled={bulkRunning || batch.entries.length === 0}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {bulkRunning ? "一括処理中..." : "一括で中空化・穴あけを実行"}
            </button>
          </div>
        </div>
        <p className="mb-2 text-[11px] text-slate-400">
          底面のどこに水抜き穴を開けるかを0〜1の割合で指定します（0.5, 0.5が中心）。実寸に関わらず同じ割合で使えます。デフォルトのまま実行しても構いません。
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {uniqueEntries.map((entry) => {
            const hole = holeSettings[entry.itemId] ?? {
              x: 0.5,
              z: 0.5,
              diameterMm: DEFAULT_HOLE_DIAMETER_MM,
            };
            const gridIds = gridIdsByItemId.get(entry.itemId) ?? [entry.gridId];
            return (
              <div
                key={entry.itemId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs"
              >
                <span className="w-auto shrink-0 font-semibold text-slate-700">
                  {gridIds.join(",")}
                  {gridIds.length > 1 && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                      ×{gridIds.length}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {entry.customerName} / {entry.subject}
                </span>
                <label className="flex items-center gap-1 text-slate-500">
                  X
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={hole.x}
                    onChange={(e) =>
                      updateHoleSetting(entry.itemId, {
                        x: Math.min(1, Math.max(0, Number(e.target.value))),
                      })
                    }
                    className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="flex items-center gap-1 text-slate-500">
                  Z
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={hole.z}
                    onChange={(e) =>
                      updateHoleSetting(entry.itemId, {
                        z: Math.min(1, Math.max(0, Number(e.target.value))),
                      })
                    }
                    className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="flex items-center gap-1 text-slate-500">
                  径
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={hole.diameterMm}
                    onChange={(e) =>
                      updateHoleSetting(entry.itemId, {
                        diameterMm: Number(e.target.value),
                      })
                    }
                    className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 outline-none focus:border-slate-500"
                  />
                  mm
                </label>
                {bulkErrors[entry.itemId] && (
                  <span className="w-full text-red-600">
                    {bulkErrors[entry.itemId]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
        <p className="mb-1 text-sm font-semibold text-slate-900">
          自分の環境で中空化・穴あけ・サポートをする場合
        </p>
        <p className="mb-2 text-[11px] text-slate-400">
          上の一括処理を使わず、Blenderなど自分の環境で中空化・穴あけ・サポートを済ませてから、その結果をここに戻すこともできます。上のリストで各アイテムのX/Z（穴位置）を先に調整しておくと、ZIPに一緒に入るので
          <code>hollow_batch.bat</code>
          側でもその位置がアイテムごとに反映されます（全アイテム共通の1点になってしまうことはありません）。①元モデル（中空化前）をZIPでダウンロード
          →
          ②自分の環境で処理（ファイル名<code>&lt;アイテムID&gt;.stl</code>は変えない）
          → ③できたSTLをまとめてアップロード。同じデザインが複数個ある場合も1ファイルで済みます（プレート配置時に自動で使い回されます）。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadRawZip}
            disabled={downloadingRaw || uniqueEntries.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {downloadingRaw ? "準備中..." : "① 元モデルをまとめてダウンロード(ZIP)"}
          </button>
          <label className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer">
            {uploadingFinished ? "アップロード中..." : "③ 仕上がったSTLをまとめてアップロード"}
            <input
              type="file"
              accept=".stl"
              multiple
              disabled={uploadingFinished}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFinishedFiles(e.target.files);
                }
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        </div>
        {rawDownloadError && <p className="mt-2 text-xs text-red-600">{rawDownloadError}</p>}
        {Object.keys(uploadResults).length > 0 && (
          <div className="mt-2 space-y-0.5 text-xs">
            {Object.entries(uploadResults).map(([key, result]) => (
              <p
                key={key}
                className={result.startsWith("✓") ? "text-emerald-600" : "text-red-600"}
              >
                {key}: {result}
              </p>
            ))}
          </div>
        )}
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
                <p className={styles.gridId}>
                  {gridId}
                  {entry?.initial && (
                    <span className="ml-1 rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700">
                      刻印:{entry.initial}
                    </span>
                  )}
                </p>
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
