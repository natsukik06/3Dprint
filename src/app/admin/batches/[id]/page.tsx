"use client";

import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import JSZip from "jszip";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import { useAuth } from "@/components/auth/AuthProvider";
import { CopyCommandRow } from "@/components/admin/CopyCommandRow";
import { PrintLabelSetButton } from "@/components/admin/PrintLabelSetButton";
import { buildGridSequence, MAX_CAPACITY } from "@/lib/batches";
import { buildBatchSummaryPdfBlob, downloadBatchSummaryPdf } from "@/lib/batchPdf";
import { buildClickpostCsvRow, CLICKPOST_CSV_HEADERS } from "@/lib/clickpost";
import { downloadCsvShiftJis, encodeShiftJis, toCsv } from "@/lib/csv";
import {
  canSaveToFolder,
  downloadFilesAsZip,
  pickFolder,
  writeFilesToFolder,
  type BundleFile,
} from "@/lib/saveFiles";
import { db } from "@/lib/firebase";
import { buildBatchLabelPrintCommand } from "@/lib/labelCommands";
import { PLATE_DEPTH_MM, PLATE_WIDTH_MM } from "@/lib/plateLayout";
import { waitForJob, type JobSnapshot } from "@/lib/watchJob";
import { estimateRemaining } from "@/lib/eta";
import type { PrintBatchRecord } from "@/types/batch";
import type { OrderItemDraft } from "@/types/order";
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

// Same click-to-pick-on-the-3D-model interaction as the single-item order detail page
// (admin/orders/[id]/page.tsx) -- shown one item at a time in a modal here instead of inline,
// since a batch can hold many items and rendering that many live 3D viewers at once would be
// heavy. Fetches its own model URL (batch entries don't carry one) and reports back a picked
// X/Z fraction on confirm.
function HolePickerModal({
  itemId,
  subject,
  initialX,
  initialZ,
  onConfirm,
  onClose,
}: {
  itemId: string;
  subject: string;
  initialX: number;
  initialZ: number;
  onConfirm: (x: number, z: number) => void;
  onClose: () => void;
}) {
  const [modelSrc, setModelSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickedX, setPickedX] = useState(initialX);
  const [pickedZ, setPickedZ] = useState(initialZ);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const [modelBounds, setModelBounds] = useState<{
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null>(null);

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "order_items", itemId))
      .then((snap) => {
        if (cancelled) return;
        const url = (snap.data()?.scaledModelUrl ?? snap.data()?.modelUrl) as string | undefined;
        if (!url) {
          setLoadError("3Dモデルが見つかりません");
          return;
        }
        setModelSrc(url);
      })
      .catch(() => {
        if (!cancelled) setLoadError("3Dモデルの読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!mv) return;
    function updateBounds() {
      if (!mv!.loaded) return;
      const dims = mv!.getDimensions();
      const center = mv!.getBoundingBoxCenter();
      setModelBounds({
        min: { x: center.x - dims.x / 2, y: center.y - dims.y / 2, z: center.z - dims.z / 2 },
        max: { x: center.x + dims.x / 2, y: center.y + dims.y / 2, z: center.z + dims.z / 2 },
      });
    }
    updateBounds();
    mv.addEventListener("load", updateBounds);
    return () => mv.removeEventListener("load", updateBounds);
  }, [modelSrc]);

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    const mv = modelViewerRef.current;
    if (!mv || !modelBounds) return;
    const rect = mv.getBoundingClientRect();
    const hit = mv.positionAndNormalFromPoint(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    const { min, max } = modelBounds;
    const spanX = max.x - min.x || 1;
    const spanZ = max.z - min.z || 1;
    setPickedX(Math.min(1, Math.max(0, (hit.position.x - min.x) / spanX)));
    setPickedZ(Math.min(1, Math.max(0, (hit.position.z - min.z) / spanZ)));
  }

  const hotspotPosition = modelBounds
    ? `${modelBounds.min.x + pickedX * (modelBounds.max.x - modelBounds.min.x)} ${modelBounds.min.y} ${modelBounds.min.z + pickedZ * (modelBounds.max.z - modelBounds.min.z)}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-sm font-semibold text-slate-900">{subject}の穴位置を指定</p>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {loadError ? (
            <div className="flex h-full items-center justify-center text-xs text-red-600">
              {loadError}
            </div>
          ) : modelSrc ? (
            <model-viewer
              ref={modelViewerRef}
              src={modelSrc}
              alt="3Dモデル"
              camera-controls
              shadow-intensity="1"
              onClick={handleClick}
              style={{ width: "100%", height: "100%", cursor: "crosshair" }}
            >
              {hotspotPosition && (
                <button
                  type="button"
                  slot="hotspot-hole"
                  data-position={hotspotPosition}
                  data-normal="0 1 0"
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "2px solid white",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                    padding: 0,
                  }}
                  aria-label="水抜き穴の位置"
                />
              )}
            </model-viewer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              読み込み中...
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          モデル上の狙いたい場所をクリックすると、その真下（底面）に穴が来るように指定されます。X={pickedX.toFixed(2)}
          , Z={pickedZ.toFixed(2)}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(pickedX, pickedZ)}
            className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            この位置にする
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchGridDashboard({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [batch, setBatch] = useState<BatchState>(undefined);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date());
  // A batch can exceed the normal 30-cell target when it holds one oversized order kept whole
  // (see generate/route.ts) -- extend the printed grid to cover every entry it actually has.
  const gridSequence = useMemo(
    () => buildGridSequence(Math.max(MAX_CAPACITY, batch?.entries.length ?? 0)),
    [batch?.entries.length]
  );
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
  // itemId currently being positioned via the 3D click-to-pick modal, or null when closed.
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  // For admins who'd rather hollow/hole/support the models themselves (their own Blender/
  // PrusaSlicer setup -- see print-pipeline/) instead of running this app's own Cloud Function.
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [bundleResult, setBundleResult] = useState<string | null>(null);
  // "あとから追加" -- extra copies of a failed design / late pending orders added to THIS batch
  // after it was created (see /api/admin/batches/[id]/add).
  const [reloadKey, setReloadKey] = useState(0);
  const [extraCopies, setExtraCopies] = useState<Record<string, number>>({});
  const [pendingGroups, setPendingGroups] = useState<
    { orderId: string; customerName: string; itemIds: string[]; subjects: string[] }[] | null
  >(null);
  const [selectedPendingOrders, setSelectedPendingOrders] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [rawDownloadError, setRawDownloadError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [deletingModels, setDeletingModels] = useState(false);
  const [deleteModelsError, setDeleteModelsError] = useState<string | null>(null);
  const [deleteModelsResult, setDeleteModelsResult] = useState<{
    deletedFiles: number;
    clearedItems: number;
  } | null>(null);
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
        completed: data.completed ?? false,
        completedAt: data.completedAt ?? null,
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
  }, [id, reloadKey]);

  // Still-unbatched order items (those that already went through processing), offered in the
  // "あとから追加" card -- reloaded after every add so what was just added disappears from the list.
  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, "order_items"), where("status", "==", "pending"))).then((snap) => {
      if (cancelled) return;
      const byOrder = new Map<
        string,
        { orderId: string; customerName: string; itemIds: string[]; subjects: string[] }
      >();
      for (const d of snap.docs) {
        const data = d.data();
        if (!data.scaledModelUrl) continue;
        const orderId = (data.orderId as string) ?? d.id;
        const group = byOrder.get(orderId) ?? {
          orderId,
          customerName: (data.customerName as string) ?? "",
          itemIds: [],
          subjects: [],
        };
        group.itemIds.push(d.id);
        group.subjects.push((data.subject as string) ?? "");
        byOrder.set(orderId, group);
      }
      setPendingGroups([...byOrder.values()]);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Fetched separately from batch.entries above -- entries only carry the per-piece summary
  // fields needed for the work-sheet grid, not the full item list each order's own label command
  // needs (colorQuantities, hardware, engraving -- see summarizeOrderItemForLabel), nor the
  // shipping fields the batch-scoped クリックポストCSV export needs.
  const [ordersById, setOrdersById] = useState<
    Record<
      string,
      {
        orderNumber?: string;
        items: OrderItemDraft[];
        customerName?: string;
        postalCode?: string;
        address?: string;
        shippingMethod?: string;
        shipped?: boolean;
      }
    >
  >({});
  useEffect(() => {
    if (!batch) return;
    const orderIds = [...new Set(batch.entries.map((e) => e.orderId))];
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        orderIds.map(async (orderId) => {
          const snap = await getDoc(doc(db, "orders", orderId));
          const data = snap.data();
          return [
            orderId,
            {
              orderNumber: data?.orderNumber,
              items: (data?.items ?? []) as OrderItemDraft[],
              customerName: data?.customerName,
              postalCode: data?.postalCode,
              address: data?.address,
              shippingMethod: data?.shippingMethod,
              shipped: data?.shipped,
            },
          ] as const;
        })
      );
      if (cancelled) return;
      setOrdersById(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [batch]);

  // Auto-completes the batch once every one of its orders is marked shipped -- one-directional
  // only (never auto-reverts to incomplete if a checkbox later gets unchecked); the explicit
  // "完了/未完了を切り替え" button below is the only way back, so a manual override always wins.
  useEffect(() => {
    if (!batch || batch.completed) return;
    const orderIds = [...new Set(batch.entries.map((e) => e.orderId))];
    if (orderIds.length === 0) return;
    const orders = orderIds.map((oid) => ordersById[oid]).filter((o) => o != null);
    if (orders.length !== orderIds.length) return;
    if (orders.every((o) => o.shipped === true)) {
      setBatchCompleted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, ordersById]);

  // Same `orders.shipped` field the order-list and production-tracker toggles already write
  // (src/app/admin/page.tsx, src/app/admin/production/page.tsx) -- scoped here to just this
  // batch's orders so the admin can run down a shipping checklist without leaving the batch page.
  async function toggleOrderShipped(orderId: string, nextShipped: boolean) {
    if (!user) return;
    setOrdersById((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], shipped: nextShipped },
    }));
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ shipped: nextShipped }),
      });
      if (!res.ok) throw new Error("failed");
    } catch (error) {
      console.error("failed to toggle shipped", error);
      setOrdersById((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], shipped: !nextShipped },
      }));
    }
  }

  async function setBatchCompleted(nextCompleted: boolean) {
    if (!batch) return;
    setBatch({ ...batch, completed: nextCompleted, completedAt: nextCompleted ? new Date() : null });
    try {
      await updateDoc(doc(db, "print_batches", id), {
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date() : null,
      });
    } catch (error) {
      console.error("failed to toggle batch completion", error);
    }
  }

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
  // One plain STL + hole.txt per unique design -- shared by the zip download, the save-to-folder
  // button and the all-in-one bundle (handleSaveBundle) below, so all three stay identical.
  async function collectRawFiles(idToken: string): Promise<BundleFile[]> {
    const perEntry = await Promise.all(
      uniqueEntries.map(async (entry): Promise<BundleFile[]> => {
        const res = await fetch(`/api/admin/order-items/${entry.itemId}/raw-stl`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `${entry.itemId}のダウンロードに失敗しました`);
        }
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
        return [
          { name: `${entry.itemId}.stl`, data: await res.blob() },
          { name: `${entry.itemId}.hole.txt`, data: `${hole.x} ${hole.z} ${hole.diameterMm}` },
        ];
      })
    );
    return perEntry.flat();
  }

  async function handleDownloadRawZip() {
    if (!user || !batch) return;
    setDownloadingRaw(true);
    setRawDownloadError(null);
    try {
      const files = await collectRawFiles(await user.getIdToken());
      await downloadFilesAsZip(`${batch.id}-raw.zip`, null, files);
    } catch (err) {
      setRawDownloadError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      setDownloadingRaw(false);
    }
  }

  // Same source files as handleDownloadRawZip, but written straight into an admin-chosen folder via
  // the File System Access API instead of a zip -- skips the extract-the-zip step entirely. Chromium
  // only, so callers must feature-detect showDirectoryPicker before showing this option.
  async function handleSaveRawToFolder() {
    if (!user || !batch) return;
    setDownloadingRaw(true);
    setRawDownloadError(null);
    try {
      const dirHandle = await pickFolder();
      const files = await collectRawFiles(await user.getIdToken());
      await writeFilesToFolder(dirHandle, null, files);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setRawDownloadError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setDownloadingRaw(false);
    }
  }

  // Adds the chosen late orders and/or extra copies (failed prints) to this batch, then reloads it.
  async function handleAddToBatch() {
    if (!user || !batch) return;
    const itemIds = (pendingGroups ?? [])
      .filter((g) => selectedPendingOrders.has(g.orderId))
      .flatMap((g) => g.itemIds);
    const copies = Object.entries(extraCopies)
      .filter(([, count]) => count > 0)
      .map(([itemId, count]) => ({ itemId, count }));
    if (itemIds.length === 0 && copies.length === 0) return;
    setAdding(true);
    setAddError(null);
    setAddResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/batches/${batch.id}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ itemIds, copies }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "追加に失敗しました");
      setAddResult(`${json.added}マス分をこのバッチに追加しました（合計${json.totalCount}マス）`);
      setExtraCopies({});
      setSelectedPendingOrders(new Set());
      setReloadKey((k) => k + 1);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  // Everything needed to start production AND ship this batch, in ONE folder (or one zip): the raw
  // model STLs + hole.txt files (what hollow_batch.bat reads), the batch-scoped クリックポスト CSV
  // (Shift-JIS, ready for clickpost.jp's まとめ申込) and the order-summary PDF. In folder mode the
  // files land in a "batch-<id>" subfolder of whatever folder gets picked, so batches never mix.
  async function handleSaveBundle(mode: "folder" | "zip") {
    if (!user || !batch) return;
    setBundleSaving(true);
    setBundleError(null);
    setBundleResult(null);
    try {
      // Picked first, synchronously from the click: the browser only allows the folder picker
      // while the click's user activation is still alive (it expires across the awaits below).
      const dirHandle = mode === "folder" ? await pickFolder() : null;

      const files: BundleFile[] = await collectRawFiles(await user.getIdToken());
      const modelCount = files.filter((f) => f.name.endsWith(".stl")).length;

      let csvIncluded = false;
      if (batchClickpostOrders.length > 0) {
        const rows = batchClickpostOrders.map((o) =>
          buildClickpostCsvRow({
            customerName: o.customerName ?? "",
            postalCode: o.postalCode ?? "",
            address: o.address ?? "",
          })
        );
        files.push({
          name: `clickpost-batch-${id}.csv`,
          data: encodeShiftJis(toCsv([...CLICKPOST_CSV_HEADERS], rows)),
        });
        csvIncluded = true;
      }

      let pdfIncluded = false;
      let pdfWarning = "";
      if (batchOrdersWithId.length > 0) {
        try {
          const createdAtLabel =
            batch && typeof batch.createdAt === "object" && batch.createdAt !== null && "toDate" in batch.createdAt
              ? (batch.createdAt as { toDate: () => Date }).toDate().toLocaleString("ja-JP")
              : "";
          files.push({
            name: `batch-${id}-summary.pdf`,
            data: await buildBatchSummaryPdfBlob(id, createdAtLabel, batchOrdersWithId),
          });
          pdfIncluded = true;
        } catch (err) {
          // The models and CSV are what production/shipping actually need -- don't lose them over
          // a failed PDF render, just say so.
          pdfWarning = `（まとめPDFだけ作成に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}）`;
        }
      }

      const folderName = `batch-${id}`;
      if (dirHandle) {
        await writeFilesToFolder(dirHandle, folderName, files);
      } else {
        await downloadFilesAsZip(`${folderName}.zip`, folderName, files);
      }
      setBundleResult(
        `${folderName} に保存しました：モデルSTL ${modelCount}点` +
          `${csvIncluded ? "＋発送CSV" : ""}${pdfIncluded ? "＋まとめPDF" : ""}${pdfWarning}`
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setBundleError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBundleSaving(false);
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
  const orderIdsInBatch = [...new Set(batch.entries.map((e) => e.orderId))];
  const batchOrders = orderIdsInBatch.map((oid) => ordersById[oid]).filter((o) => o != null);
  // Same rows as batchOrders, but keeping the orderId alongside -- needed for the shipping
  // checklist (which order to toggle) and the PDF summary (BatchPdfOrder.orderId), unlike
  // batchOrders' other consumers (label command, クリックポストCSV) which never need it.
  const batchOrdersWithId = orderIdsInBatch
    .map((oid) => (ordersById[oid] ? { orderId: oid, ...ordersById[oid] } : null))
    .filter((o): o is NonNullable<typeof o> => o != null);
  const batchLabelCommand =
    batchOrders.length > 0 ? buildBatchLabelPrintCommand(batchOrders) : "";
  // Same まとめ申込CSV as admin/shipping, but scoped to just this batch's orders instead of
  // every unshipped クリックポスト order site-wide -- lets the admin ship a batch as soon as it's
  // done without waiting on (or accidentally re-including) unrelated batches.
  const batchClickpostOrders = batchOrders.filter(
    // !== true (not === false) so older orders created before the `shipped` field existed --
    // where it's undefined rather than explicitly false -- still count as "not yet shipped"
    // instead of silently dropping out of the batch CSV.
    (o) => o.shippingMethod === "クリックポスト" && o.shipped !== true
  );
  function handleBatchClickpostExport() {
    const rows = batchClickpostOrders.map((o) =>
      buildClickpostCsvRow({
        customerName: o.customerName ?? "",
        postalCode: o.postalCode ?? "",
        address: o.address ?? "",
      })
    );
    downloadCsvShiftJis(`clickpost-batch-${id}-${Date.now()}.csv`, toCsv([...CLICKPOST_CSV_HEADERS], rows));
  }

  async function handleDownloadPdf() {
    setPdfGenerating(true);
    setPdfError(null);
    try {
      const createdAtLabel =
        batch && typeof batch.createdAt === "object" && batch.createdAt !== null && "toDate" in batch.createdAt
          ? (batch.createdAt as { toDate: () => Date }).toDate().toLocaleString("ja-JP")
          : "";
      await downloadBatchSummaryPdf(id, createdAtLabel, batchOrdersWithId);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDFの生成に失敗しました");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleDeleteModels() {
    if (!user) return;
    if (
      !window.confirm(
        "USB等に3Dモデルを退避済みですか？\n\nこのバッチの生産用モデルファイル（scaledModelUrl/finishedModelUrl）をFirebase Storageから完全に削除します。元に戻せません。\n\n元モデル（お客様マイページ表示用）と注文記録は削除されません。"
      )
    ) {
      return;
    }
    setDeletingModels(true);
    setDeleteModelsError(null);
    setDeleteModelsResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/batches/${id}/delete-models`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      setDeleteModelsResult(json);
    } catch (err) {
      setDeleteModelsError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingModels(false);
    }
  }

  async function handleUndoBatch() {
    if (!user || !batch) return;
    const workDoneWarning =
      batch.completedCells.length > 0
        ? `\n\n（${batch.completedCells.length}個のセルが完了チェック済みです。取り消すとこのチェックも失われます）`
        : "";
    if (
      !window.confirm(
        `このバッチを削除して、含まれる${orderIdsInBatch.length}件の注文を「未バッチ」に戻します。よろしいですか？${workDoneWarning}`
      )
    ) {
      return;
    }
    setUndoing(true);
    setUndoError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/batches/${id}/undo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取り消しに失敗しました");
      router.push("/admin/batches");
    } catch (err) {
      setUndoError(err instanceof Error ? err.message : "取り消しに失敗しました");
      setUndoing(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${styles.noPrint}`}>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/batches"
            className="text-sm text-slate-600 underline underline-offset-2"
          >
            ← バッチ一覧に戻る
          </Link>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              batch.completed
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {batch.completed ? "完了" : "進行中"}
          </span>
          <button
            type="button"
            onClick={() => setBatchCompleted(!batch.completed)}
            className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            {batch.completed ? "未完了に戻す" : "手動で完了にする"}
          </button>
          {!batch.completed && (
            <button
              type="button"
              onClick={handleUndoBatch}
              disabled={undoing}
              className="text-xs text-red-600 underline underline-offset-2 hover:text-red-800 disabled:opacity-50"
            >
              {undoing ? "取り消し中..." : "間違えて作成した場合：このバッチを取り消す"}
            </button>
          )}
        </div>
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
      {undoError && <p className={`mb-4 text-sm text-red-600 ${styles.noPrint}`}>{undoError}</p>}

      <div className={`mb-4 rounded-xl border-2 border-slate-800 bg-white p-4 ${styles.noPrint}`}>
        <p className="mb-1 text-sm font-semibold text-slate-900">
          バッチ一式を同じフォルダに保存（モデル＋発送CSV＋まとめPDF）
        </p>
        <p className="mb-3 text-xs text-slate-600">
          元モデルSTL（穴位置の<code>.hole.txt</code>つき）・クリックポスト発送CSV（このバッチの未発送分）・注文まとめPDFを、
          <code>batch-{id}</code> フォルダにまとめて保存します。そのまま <code>hollow_batch.bat</code> の対象フォルダに使えます。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canSaveToFolder() && (
            <button
              type="button"
              onClick={() => handleSaveBundle("folder")}
              disabled={bundleSaving || uniqueEntries.length === 0}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {bundleSaving ? "保存中..." : "フォルダを選んで一式を保存"}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSaveBundle("zip")}
            disabled={bundleSaving || uniqueEntries.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {bundleSaving ? "準備中..." : "一式をZIPでダウンロード"}
          </button>
        </div>
        {bundleError && <p className="mt-2 text-sm text-red-600">{bundleError}</p>}
        {bundleResult && <p className="mt-2 text-xs text-emerald-700">{bundleResult}</p>}
      </div>

      <div className={`mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 ${styles.noPrint}`}>
        <p className="mb-1 text-sm font-semibold text-slate-900">
          あとから追加する（印刷に失敗した分の再印刷・遅れて入った注文）
        </p>
        {batch.completed ? (
          <p className="text-xs text-slate-600">
            完了済みのバッチには追加できません。追加したい場合は、先に「未完了に戻す」を押してください。
          </p>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-slate-500">
              バッチを作ったあとでも、失敗したピースの再印刷や、あとから入った注文をこのバッチに足せます。足した分は新しいマスが追加され、再印刷は「再」と表示されます。モデルは元のものを使い回すので、中空化のやり直しは不要です。
            </p>

            <p className="mb-1 text-xs font-semibold text-slate-700">失敗したピースを再印刷用に追加</p>
            <div className="mb-3 divide-y divide-amber-100 rounded-lg border border-amber-200 bg-white">
              {uniqueEntries.map((entry) => {
                const have = batch.entries.filter((e) => e.itemId === entry.itemId).length;
                const extra = extraCopies[entry.itemId] ?? 0;
                return (
                  <div key={entry.itemId} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {entry.initial && (
                        <span className="mr-1 rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700">
                          {entry.initial}
                        </span>
                      )}
                      {entry.subject}（{entry.customerName}様）
                      <span className="ml-1 text-xs text-slate-400">現在{have}個</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExtraCopies((prev) => ({ ...prev, [entry.itemId]: Math.max(0, extra - 1) }))
                        }
                        disabled={extra <= 0 || adding}
                        aria-label="減らす"
                        className="h-7 w-7 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">+{extra}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setExtraCopies((prev) => ({ ...prev, [entry.itemId]: Math.min(30, extra + 1) }))
                        }
                        disabled={adding}
                        aria-label="増やす"
                        className="h-7 w-7 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mb-1 text-xs font-semibold text-slate-700">未バッチの注文をこのバッチに追加</p>
            {pendingGroups === null ? (
              <p className="mb-3 text-xs text-slate-400">読み込み中...</p>
            ) : pendingGroups.length === 0 ? (
              <p className="mb-3 text-xs text-slate-400">未バッチの注文はありません</p>
            ) : (
              <div className="mb-3 divide-y divide-amber-100 rounded-lg border border-amber-200 bg-white">
                {pendingGroups.map((group) => (
                  <label key={group.orderId} className="flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedPendingOrders.has(group.orderId)}
                      onChange={() =>
                        setSelectedPendingOrders((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.orderId)) next.delete(group.orderId);
                          else next.add(group.orderId);
                          return next;
                        })
                      }
                      className="h-4 w-4 shrink-0 accent-slate-800"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {group.customerName}様　{group.subjects.join(" / ")}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToBatch}
              disabled={
                adding ||
                (selectedPendingOrders.size === 0 &&
                  Object.values(extraCopies).every((count) => count <= 0))
              }
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {adding ? "追加中..." : "選んだ内容をこのバッチに追加"}
            </button>
            {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
            {addResult && <p className="mt-2 text-xs text-emerald-700">{addResult}</p>}
          </>
        )}
      </div>

      {batchLabelCommand && (
        <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
          <p className="mb-1 text-sm font-semibold text-slate-900">
            バッチ内の注文のラベルをまとめて印刷
          </p>
          <p className="mb-2 text-[11px] text-slate-400">
            このバッチに含まれる注文（{batchOrders.length}件）ぶんを、注文ごとに「内容物ラベル→ロゴ→感謝文」のセットで順番に印刷します。
          </p>
          <PrintLabelSetButton
            orders={batchOrders.map((o) => ({ orderNumber: o.orderNumber ?? "", items: o.items }))}
            buttonLabel={`バッチ内${batchOrders.length}件のラベルを一式印刷`}
          />
          <details className="mt-3 text-[11px] text-slate-400">
            <summary className="cursor-pointer">印刷サーバーを使わず、コマンドで印刷する場合</summary>
            <div className="mt-2">
              <p className="mb-2">
                <code>diy-figure-app</code>フォルダを開いたターミナルにコピーして貼り付けてEnterを押すと、注文ごとに1枚ずつ順番に印刷されます（内容物ラベルのみ）。
              </p>
              <CopyCommandRow label="内容物ラベル（バッチ内全注文）" command={batchLabelCommand} />
            </div>
          </details>
        </div>
      )}

      {batchClickpostOrders.length > 0 && (
        <div className={`mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 ${styles.noPrint}`}>
          <p className="mb-1 text-sm font-medium text-slate-900">
            クリックポスト まとめ申込用CSV（このバッチのみ）
          </p>
          <p className="mb-3 text-xs text-slate-600">
            このバッチ内の未発送クリックポスト分（{batchClickpostOrders.length}件）だけをCSV出力します。clickpost.jpの「まとめ申込」にそのままアップロードできます。
          </p>
          <button
            type="button"
            onClick={handleBatchClickpostExport}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            クリックポストCSVダウンロード（バッチ内）
          </button>
        </div>
      )}

      {batchOrdersWithId.length > 0 && (
        <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
          <p className="mb-1 text-sm font-semibold text-slate-900">発送チェックリスト</p>
          <p className="mb-2 text-[11px] text-slate-400">
            全注文にチェックが入ると、このバッチは自動で「完了」に切り替わります。
          </p>
          <div className="divide-y divide-slate-100">
            {batchOrdersWithId.map((order) => (
              <label
                key={order.orderId}
                className="flex cursor-pointer items-center gap-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={order.shipped === true}
                  onChange={(e) => toggleOrderShipped(order.orderId, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-emerald-700"
                />
                <span className="flex-1 text-sm text-slate-900">
                  {order.orderNumber ?? order.orderId}　{order.customerName}様
                </span>
                <span className="text-xs text-slate-400">{order.shippingMethod ?? ""}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 ${styles.noPrint}`}>
        <p className="mb-1 text-sm font-semibold text-slate-900">
          バッチのデータをUSBに退避して整理する
        </p>
        <p className="mb-3 text-[11px] text-slate-400">
          注文まとめPDFと「①元モデルをまとめてダウンロード(ZIP)」（下のカード）を一緒にUSB等へ保存してから、モデルファイルを削除してStorage容量を空けられます。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfGenerating || batchOrdersWithId.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pdfGenerating ? "生成中..." : "注文まとめPDFをダウンロード"}
          </button>
          <button
            type="button"
            onClick={handleDeleteModels}
            disabled={!batch.completed || deletingModels}
            title={batch.completed ? undefined : "発送チェックリストが完了するとモデル削除ができます"}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletingModels ? "削除中..." : "モデルファイルを削除（Storage容量整理）"}
          </button>
        </div>
        {pdfError && <p className="mt-2 text-sm text-red-600">{pdfError}</p>}
        {deleteModelsError && <p className="mt-2 text-sm text-red-600">{deleteModelsError}</p>}
        {deleteModelsResult && (
          <p className="mt-2 text-xs text-emerald-700">
            {deleteModelsResult.clearedItems}件のアイテムから、計{deleteModelsResult.deletedFiles}
            個のモデルファイルを削除しました。
          </p>
        )}
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
          {typeof window !== "undefined" && "showDirectoryPicker" in window && (
            <button
              type="button"
              onClick={handleSaveRawToFolder}
              disabled={downloadingRaw || uniqueEntries.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {downloadingRaw ? "準備中..." : "① フォルダに直接保存(ZIP解凍不要)"}
            </button>
          )}
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
                <button
                  type="button"
                  onClick={() => setPickerItemId(entry.itemId)}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  🎯 3Dで指定
                </button>
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
                  {entry?.reprint && (
                    <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-800">
                      再
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

      {pickerItemId &&
        (() => {
          const entry = uniqueEntries.find((e) => e.itemId === pickerItemId);
          if (!entry) return null;
          const hole = holeSettings[pickerItemId] ?? {
            x: 0.5,
            z: 0.5,
            diameterMm: DEFAULT_HOLE_DIAMETER_MM,
          };
          return (
            <HolePickerModal
              itemId={pickerItemId}
              subject={entry.subject}
              initialX={hole.x}
              initialZ={hole.z}
              onClose={() => setPickerItemId(null)}
              onConfirm={(x, z) => {
                updateHoleSetting(pickerItemId, { x, z });
                setPickerItemId(null);
              }}
            />
          );
        })()}
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
