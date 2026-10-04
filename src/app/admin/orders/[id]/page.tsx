"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@google/model-viewer";
import { useAuth } from "@/components/auth/AuthProvider";
import { CopyCommandRow } from "@/components/admin/CopyCommandRow";
import { PrintLabelSetButton } from "@/components/admin/PrintLabelSetButton";
import { downloadFileAs, sanitizeFilenamePart } from "@/lib/downloadFile";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, POSE_LABELS, formatYen } from "@/lib/pricing";
import { buildLabelPrintCommands } from "@/lib/labelCommands";
import { waitForJob, type JobSnapshot } from "@/lib/watchJob";
import { estimateRemaining } from "@/lib/eta";
import {
  HARDWARE_COLOR_LABELS,
  MAGIC_COLOR_OPTIONS,
  MODEL_STYLE_LABELS,
  ORDER_STATUS_LABELS,
  type OrderItemDraft,
  type OrderItemRecord,
  type PaymentStatus,
} from "@/types/order";

type OrderDetail = {
  orderNumber?: string;
  items: OrderItemDraft[];
  estimatedPriceYen: number;
  shippingYen: number;
  discountYen: number;
  shippingMethod: string | null;
  customerName: string;
  customerEmail: string;
  postalCode: string;
  address: string;
  phoneNumber: string;
  requestNote: string;
  agreeShowcase: boolean;
  createdAt: { toDate: () => Date } | null;
  paymentStatus: PaymentStatus;
  paidAt: { toDate: () => Date } | null;
  shipped: boolean;
  shippedAt: { toDate: () => Date } | null;
};

// Production data for one item, keyed by its position in order.items. Only exists once payment
// succeeds and processOrder fans the order out into order_items docs.
type ItemProduction = OrderItemRecord & { id: string };

// Matches DEFAULT_WALL_THICKNESS_MM in the finish-mesh API route.
const DEFAULT_WALL_THICKNESS_MM = 0.8;
// Matches hollowMesh's own default in functions/src/lib/meshBoolean.ts.
const DEFAULT_SPHERE_SEGMENTS = 32;
const ACCURACY_PRESETS = [
  { segments: 16, label: "粗い（高速）" },
  { segments: 32, label: "標準（推奨）" },
  { segments: 48, label: "高精度（低速）" },
] as const;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ItemCard({
  item,
  index,
  orderNumber,
  production,
  onProductionChange,
}: {
  item: OrderItemDraft;
  index: number;
  orderNumber: string;
  production: ItemProduction | null;
  onProductionChange: (next: ItemProduction) => void;
}) {
  const { user } = useAuth();
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [finishingMesh, setFinishingMesh] = useState(false);
  const [finishMeshError, setFinishMeshError] = useState<string | null>(null);
  const [finishMeshProgress, setFinishMeshProgress] = useState<JobSnapshot | null>(null);
  const [finishMeshStartedAt, setFinishMeshStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [wallThicknessMm, setWallThicknessMm] = useState(DEFAULT_WALL_THICKNESS_MM);
  const [sphereSegments, setSphereSegments] = useState<number>(DEFAULT_SPHERE_SEGMENTS);
  // Where the drain hole sits on the model's bottom face, as a 0-1 fraction of its footprint
  // (0.5, 0.5 = centered). Sent to the finish-mesh job so it's cut in the right spot before
  // hollowing+holes ever leave this page -- adjust per item to dodge a visible face or a support.
  const [bottomHoleX, setBottomHoleX] = useState(0.5);
  const [bottomHoleZ, setBottomHoleZ] = useState(0.5);
  const [bottomHoleDiameterMm, setBottomHoleDiameterMm] = useState(2);
  // Lets the admin click directly on the model instead of guessing X/Z fractions blindly.
  const [pickMode, setPickMode] = useState(false);
  const [downloadingRawStl, setDownloadingRawStl] = useState(false);
  const [rawStlError, setRawStlError] = useState<string | null>(null);
  const rawModelViewerRef = useRef<ModelViewerElement | null>(null);
  const [modelBounds, setModelBounds] = useState<{
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null>(null);

  const modelSrc = production?.scaledModelUrl ?? item.modelUrl ?? undefined;

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  // Ticks once a second while a job is running so the elapsed/remaining-time readout below keeps
  // counting up even between Firestore progress updates (which land sparsely, not every second).
  useEffect(() => {
    if (!finishingMesh) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [finishingMesh]);

  // Same coordinate frame getDimensions()/getBoundingBoxCenter() and positionAndNormalFromPoint()
  // both use (the model's own local space, excluding model-viewer's internal centering) -- so a
  // fraction computed from a click lines up with the same X/Z-fraction-of-footprint convention
  // the finish-mesh Cloud Function already uses server-side (see bottomHoleXFraction there).
  useEffect(() => {
    const mv = rawModelViewerRef.current;
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

  function handlePickClick(e: React.MouseEvent<HTMLElement>) {
    if (!pickMode) return;
    const mv = rawModelViewerRef.current;
    if (!mv || !modelBounds) return;
    const rect = mv.getBoundingClientRect();
    const hit = mv.positionAndNormalFromPoint(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    const { min, max } = modelBounds;
    const spanX = max.x - min.x || 1;
    const spanZ = max.z - min.z || 1;
    setBottomHoleX(Math.min(1, Math.max(0, (hit.position.x - min.x) / spanX)));
    setBottomHoleZ(Math.min(1, Math.max(0, (hit.position.z - min.z) / spanZ)));
    setPickMode(false);
  }

  const hotspotPosition = modelBounds
    ? `${modelBounds.min.x + bottomHoleX * (modelBounds.max.x - modelBounds.min.x)} ${modelBounds.min.y} ${modelBounds.min.z + bottomHoleZ * (modelBounds.max.z - modelBounds.min.z)}`
    : null;

  async function refetchProduction() {
    if (!production) return;
    const snap = await getDoc(doc(db, "order_items", production.id));
    if (snap.exists()) {
      onProductionChange({ id: snap.id, ...(snap.data() as OrderItemRecord) });
    }
  }

  async function handleReprocess() {
    if (!user || !production) return;
    setReprocessing(true);
    setReprocessError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/process-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId: production.orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "処理に失敗しました");
      await refetchProduction();
    } catch (err) {
      setReprocessError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setReprocessing(false);
    }
  }

  // Same /raw-stl conversion route the batch page's ZIP download uses (see handleDownloadRawZip
  // in admin/batches/[id]/page.tsx) -- lets the admin grab a pre-hollow model for their slicer
  // without first having to batch the order. Needs the auth header, so downloadFileAs (a plain
  // unauthenticated fetch, used below for the already-STL finishedModelUrl) doesn't apply here.
  async function handleDownloadRawStl() {
    if (!user || !production) return;
    setDownloadingRawStl(true);
    setRawStlError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/order-items/${production.id}/raw-stl`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "ダウンロードに失敗しました");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFilenamePart(production.customerName)}-${orderNumber}-${sanitizeFilenamePart(item.subject)}-元モデル.stl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRawStlError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      setDownloadingRawStl(false);
    }
  }

  async function handleFinishMesh() {
    if (!user || !production) return;
    setFinishingMesh(true);
    setFinishMeshError(null);
    setFinishMeshProgress(null);
    setFinishMeshStartedAt(Date.now());
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/order-items/${production.id}/finish-mesh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          wallThicknessMm,
          sphereSegments,
          bottomHoleXFraction: bottomHoleX,
          bottomHoleZFraction: bottomHoleZ,
          bottomHoleDiameterMm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "処理の予約に失敗しました");
      // The Cloud Function does the actual (potentially multi-minute) work; this just watches
      // the job doc it updates until it finishes.
      await waitForJob(json.jobId as string, setFinishMeshProgress);
      await refetchProduction();
    } catch (err) {
      setFinishMeshError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setFinishingMesh(false);
      setFinishMeshProgress(null);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        アイテム{index + 1}：{item.subject}
        <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
          {item.sizeOption}
        </span>
        {item.isCustomModel && (
          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
            お客様提供モデル
          </span>
        )}
        {item.subjectType === "object" && (
          <span className="ml-1 rounded bg-teal-100 px-1 text-[10px] font-bold text-teal-700">
            モノ・思い出の品
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {modelSrc ? (
            <model-viewer
              ref={rawModelViewerRef}
              src={modelSrc}
              alt="3Dモデル"
              camera-controls
              auto-rotate={!pickMode}
              shadow-intensity="1"
              onClick={handlePickClick}
              style={{ width: "100%", height: "100%", cursor: pickMode ? "crosshair" : undefined }}
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
              3Dモデルなし
            </div>
          )}
          {modelSrc && (
            <button
              type="button"
              onClick={() => setPickMode((prev) => !prev)}
              className={`absolute bottom-2 right-2 rounded-lg px-2 py-1 text-[10px] font-semibold shadow ${
                pickMode
                  ? "bg-red-600 text-white"
                  : "bg-white/90 text-slate-700 hover:bg-white"
              }`}
            >
              {pickMode ? "モデルをクリックして指定..." : "📍 クリックで穴位置を指定"}
            </button>
          )}
        </div>
        <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {Object.values(item.finishedPreviewUrls)[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={Object.values(item.finishedPreviewUrls)[0]}
              alt="完成イメージ"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              完成イメージなし
            </div>
          )}
        </div>
      </div>

      {Object.keys(item.finishedPreviewUrls).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {MAGIC_COLOR_OPTIONS.filter((c) => item.finishedPreviewUrls[c]).map((color) => (
            <a
              key={color}
              href={item.finishedPreviewUrls[color]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1"
            >
              <span className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.finishedPreviewUrls[color]}
                  alt={MAGIC_COLOR_LABELS[color]}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="text-[10px] text-slate-500">
                {MAGIC_COLOR_LABELS[color]}
              </span>
            </a>
          ))}
        </div>
      )}

      {item.referenceImageUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.referenceImageUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="参考写真" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}

      <div>
        {item.subjectType === "object" ? (
          <>
            {item.furColorNote && <InfoRow label="色・柄" value={item.furColorNote} />}
            {item.breedNote && <InfoRow label="素材・材質" value={item.breedNote} />}
            {item.accessoryNote && (
              <InfoRow label="ロゴ・装飾などの扱い" value={item.accessoryNote} />
            )}
            {item.bodyFeatureNote && (
              <InfoRow label="欠け・傷など特徴的な部分" value={item.bodyFeatureNote} />
            )}
          </>
        ) : (
          <>
            {item.furColorNote && <InfoRow label="毛色・柄" value={item.furColorNote} />}
            {item.breedNote && <InfoRow label="犬種・ミックス" value={item.breedNote} />}
            {item.accessoryNote && (
              <InfoRow label="服・首輪などの扱い" value={item.accessoryNote} />
            )}
            {item.bodyFeatureNote && (
              <InfoRow label="しっぽ・耳など体の特徴" value={item.bodyFeatureNote} />
            )}
          </>
        )}
        {item.subjectType !== "object" && (
          <InfoRow label="ポーズ" value={POSE_LABELS[item.pose]} />
        )}
        <InfoRow
          label="仕上がりスタイル"
          value={MODEL_STYLE_LABELS[item.modelStyle] ?? "デフォルメ（かわいいトイ風）"}
        />
        <InfoRow
          label="自立させる"
          value={item.wantsSelfStanding ? "はい（足元の安定を優先して生成）" : "いいえ"}
        />
        <InfoRow
          label="カラー・個数"
          value={MAGIC_COLOR_OPTIONS.filter((c) => (item.colorQuantities[c] ?? 0) > 0)
            .map((c) => `${MAGIC_COLOR_LABELS[c]} ×${item.colorQuantities[c]}`)
            .join(" / ")}
        />
        <InfoRow
          label="上の穴（金具用）"
          value={
            item.wantsHardware
              ? item.chainPositionNote
                ? `希望あり：${item.chainPositionNote}`
                : "希望あり（位置指定なし・おまかせ）"
              : "なし"
          }
        />
        {item.wantsHardware && (
          <InfoRow label="金具の色" value={HARDWARE_COLOR_LABELS[item.hardwareColor]} />
        )}
        {item.wantsEngraving && (
          <>
            <InfoRow label="刻印文字" value={item.engravingText || "（未入力）"} />
            <InfoRow label="刻印フォント" value={item.engravingFont} />
          </>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        {!production ? (
          <p className="text-xs text-slate-500">支払い完了後に生産処理が開始されます</p>
        ) : (
          <>
            <InfoRow
              label="スケーリング後サイズ"
              value={
                production.maxDimensionMm
                  ? `最大辺 ${production.maxDimensionMm.toFixed(1)}mm`
                  : "未処理"
              }
            />
            <InfoRow label="ステータス" value={ORDER_STATUS_LABELS[production.status]} />
            <InfoRow
              label="バッチ/グリッド"
              value={
                production.batchId ? `${production.batchId} / ${production.gridId}` : "未割当"
              }
            />
            {!production.scaledModelUrl && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReprocess}
                  disabled={reprocessing}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {reprocessing ? "処理中..." : "再スケーリング処理を実行"}
                </button>
                {reprocessError && (
                  <p className="mt-1 text-xs text-red-600">{reprocessError}</p>
                )}
              </div>
            )}
            {production.scaledModelUrl && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadRawStl}
                  disabled={downloadingRawStl}
                  className="text-xs text-slate-800 underline underline-offset-2 disabled:opacity-60"
                >
                  {downloadingRawStl ? "準備中..." : "元モデルをSTLでダウンロード"}
                </button>
                {rawStlError && <p className="mt-1 text-xs text-red-600">{rawStlError}</p>}
              </div>
            )}
            <div className="mt-2 border-t border-slate-200 pt-2">
              <InfoRow
                label="中空化・穴あけ"
                value={
                  production.finishedModelUrl
                    ? `完了（壁厚${production.wallThicknessMm ?? "-"}mm）`
                    : "未処理"
                }
              />
              {production.finishedModelUrl && (
                <>
                  <InfoRow
                    label="通気穴"
                    value={
                      production.ventHoleSource === "customer"
                        ? "あり（顧客指定の金具穴/コルク穴を使用）"
                        : production.ventHoleSource === "manual"
                          ? "あり（管理者が自分の環境で中空化・穴あけ済み）"
                          : "あり（自動追加・底面中心）"
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      downloadFileAs(
                        production.finishedModelUrl!,
                        `${sanitizeFilenamePart(production.customerName)}-${orderNumber}-${sanitizeFilenamePart(item.subject)}-中空化済み.stl`
                      ).catch((err) => console.error("model download failed", err))
                    }
                    className="mt-1 inline-block text-xs text-slate-800 underline underline-offset-2"
                  >
                    中空化済みSTLをダウンロード
                  </button>
                </>
              )}
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                  壁厚
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={wallThicknessMm}
                      onChange={(e) => setWallThicknessMm(Number(e.target.value))}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                    mm
                  </span>
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                  精度
                  <select
                    value={sphereSegments}
                    onChange={(e) => setSphereSegments(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  >
                    {ACCURACY_PRESETS.map((preset) => (
                      <option key={preset.segments} value={preset.segments}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                  水抜き穴 X位置（0〜1）
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={bottomHoleX}
                    onChange={(e) =>
                      setBottomHoleX(Math.min(1, Math.max(0, Number(e.target.value))))
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                  水抜き穴 Z位置（0〜1）
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={bottomHoleZ}
                    onChange={(e) =>
                      setBottomHoleZ(Math.min(1, Math.max(0, Number(e.target.value))))
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                  穴径
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={bottomHoleDiameterMm}
                      onChange={(e) => setBottomHoleDiameterMm(Number(e.target.value))}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                    />
                    mm
                  </span>
                </label>
                <p className="w-full text-[10px] text-slate-400">
                  左上のプレビューの「📍クリックで穴位置を指定」を押してからモデル上の狙いたい場所をクリックすると、その真下（底面）に穴が来るようにX/Zが自動入力されます。数値を直接微調整することもできます。
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFinishMesh}
                  disabled={finishingMesh || !production.scaledModelUrl}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {finishingMesh
                    ? "処理中..."
                    : production.finishedModelUrl
                      ? "中空化・穴あけを再実行"
                      : "中空化・穴あけ処理を実行"}
                </button>
                {finishingMesh && finishMeshProgress && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all"
                        style={{ width: `${finishMeshProgress.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {finishMeshProgress.message ?? "処理中..."}
                      {finishMeshStartedAt && (() => {
                        const eta = estimateRemaining(
                          finishMeshStartedAt,
                          finishMeshProgress.progress,
                          nowTick
                        );
                        return (
                          <>
                            {" "}
                            （経過{eta.elapsedLabel}
                            {eta.remainingLabel && ` ／ 残り約${eta.remainingLabel}`}）
                          </>
                        );
                      })()}
                    </p>
                  </div>
                )}
                {finishMeshError && (
                  <p className="mt-1 text-xs text-red-600">{finishMeshError}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminOrderDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);
  const [productionByIndex, setProductionByIndex] = useState<
    Record<number, ItemProduction>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const snap = await getDoc(doc(db, "orders", id));
        if (cancelled) return;
        if (!snap.exists()) {
          setOrder(null);
          return;
        }
        const data = snap.data();
        setOrder({
          orderNumber: data.orderNumber,
          items: (data.items ?? []) as OrderItemDraft[],
          estimatedPriceYen: data.estimatedPriceYen ?? 0,
          shippingYen: data.shippingYen ?? 0,
          discountYen: data.discountYen ?? 0,
          shippingMethod: data.shippingMethod ?? null,
          customerName: data.customerName ?? "",
          customerEmail: data.customerEmail ?? "",
          postalCode: data.postalCode ?? "",
          address: data.address ?? "",
          phoneNumber: data.phoneNumber ?? "",
          requestNote: data.requestNote ?? "",
          agreeShowcase: data.agreeShowcase ?? false,
          createdAt: data.createdAt ?? null,
          paymentStatus: data.paymentStatus ?? "unpaid",
          paidAt: data.paidAt ?? null,
          shipped: data.shipped ?? false,
          shippedAt: data.shippedAt ?? null,
        });

        const itemsSnap = await getDocs(
          query(collection(db, "order_items"), where("orderId", "==", id))
        );
        if (cancelled) return;
        const byIndex: Record<number, ItemProduction> = {};
        for (const itemDoc of itemsSnap.docs) {
          const itemData = itemDoc.data() as OrderItemRecord;
          byIndex[itemData.itemIndex] = { id: itemDoc.id, ...itemData };
        }
        setProductionByIndex(byIndex);
      } catch {
        if (!cancelled) setOrder(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (order === undefined) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }
  if (order === null) {
    return <p className="text-sm text-slate-500">注文が見つかりません</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow label="注文番号" value={order.orderNumber ?? id} />
        <InfoRow label="セット点数" value={`${order.items.length}点`} />
        <InfoRow
          label="送料"
          value={order.shippingYen === 0 ? "無料" : formatYen(order.shippingYen)}
        />
        {order.discountYen > 0 && (
          <InfoRow label="割引" value={`-${formatYen(order.discountYen)}`} />
        )}
        <InfoRow label="合計金額" value={formatYen(order.estimatedPriceYen)} />
        <InfoRow label="配送方法" value={order.shippingMethod ?? "未処理（支払い後に自動判定）"} />
        <InfoRow
          label="実績紹介への使用許可"
          value={order.agreeShowcase ? "許可あり" : "許可なし"}
        />
        <InfoRow
          label="支払い状況"
          value={
            order.paymentStatus === "paid"
              ? `支払い済み${order.paidAt ? `（${order.paidAt.toDate().toLocaleString("ja-JP")}）` : ""}`
              : "未払い"
          }
        />
        {order.paymentStatus === "paid" && (
          <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
            <span className="text-slate-500">発送状況</span>
            <div className="flex items-center gap-2">
              <span className="text-right font-medium text-slate-900">
                {order.shipped
                  ? `発送済み${order.shippedAt ? `（${order.shippedAt.toDate().toLocaleString("ja-JP")}）` : ""}`
                  : "未発送"}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  const next = !order.shipped;
                  setOrder({ ...order, shipped: next, shippedAt: null });
                  try {
                    const idToken = await user.getIdToken();
                    const res = await fetch(`/api/admin/orders/${id}/ship`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${idToken}`,
                      },
                      body: JSON.stringify({ shipped: next }),
                    });
                    if (!res.ok) throw new Error("failed");
                  } catch (error) {
                    console.error("failed to toggle shipped", error);
                    setOrder({ ...order, shipped: !next });
                  }
                }}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                  order.shipped
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
              >
                {order.shipped ? "未発送に戻す" : "発送済みにする"}
              </button>
            </div>
          </div>
        )}
      </div>

      {order.items.map((item, index) => (
        <ItemCard
          key={index}
          item={item}
          index={index}
          orderNumber={order.orderNumber ?? id}
          production={productionByIndex[index] ?? null}
          onProductionChange={(next) =>
            setProductionByIndex((prev) => ({ ...prev, [index]: next }))
          }
        />
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow label="お名前" value={order.customerName} />
        <InfoRow label="メール" value={order.customerEmail} />
        <InfoRow label="電話番号" value={order.phoneNumber} />
        <InfoRow label="配送先" value={`〒${order.postalCode} ${order.address}`} />
        {order.requestNote && (
          <div className="pt-2">
            <p className="text-xs text-slate-500">ご要望</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
              {order.requestNote}
            </p>
          </div>
        )}
        {order.createdAt && (
          <InfoRow
            label="注文日時"
            value={order.createdAt.toDate().toLocaleString("ja-JP")}
          />
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">ラベル印刷</p>
        <p className="text-xs text-slate-500">
          ボタンひとつで、注文内容ラベル・ロゴ・ご注文の感謝文を1セットで印刷します。宛先・差出人は配送業者側の公式ラベル/送り状に既に載るため、ここでは作っていません。
        </p>
        <PrintLabelSetButton
          orders={[{ orderNumber: order.orderNumber ?? id, items: order.items }]}
          buttonLabel="ラベルを一式印刷（内容物＋ロゴ＋感謝文）"
        />
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">印刷サーバーを使わず、コマンドで印刷する場合</summary>
          <div className="mt-2">
            <CopyCommandRow label="注文内容ラベル" command={buildLabelPrintCommands(order).contents} />
          </div>
        </details>
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
      >
        ← 注文一覧に戻る
      </Link>
      <h1 className="mb-6 text-xl font-bold text-slate-900">注文詳細</h1>
      <AdminOrderDetail id={params.id} />
    </main>
  );
}
