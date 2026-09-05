"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, POSE_LABELS, formatYen } from "@/lib/pricing";
import { waitForJob, type JobSnapshot } from "@/lib/watchJob";
import {
  MAGIC_COLOR_OPTIONS,
  ORDER_STATUS_LABELS,
  type OrderItemDraft,
  type OrderItemRecord,
  type PaymentStatus,
} from "@/types/order";

type OrderDetail = {
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
  production,
  onProductionChange,
}: {
  item: OrderItemDraft;
  index: number;
  production: ItemProduction | null;
  onProductionChange: (next: ItemProduction) => void;
}) {
  const { user } = useAuth();
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [finishingMesh, setFinishingMesh] = useState(false);
  const [finishMeshError, setFinishMeshError] = useState<string | null>(null);
  const [finishMeshProgress, setFinishMeshProgress] = useState<JobSnapshot | null>(null);
  const [wallThicknessMm, setWallThicknessMm] = useState(DEFAULT_WALL_THICKNESS_MM);
  const [sphereSegments, setSphereSegments] = useState<number>(DEFAULT_SPHERE_SEGMENTS);

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

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

  async function handleFinishMesh() {
    if (!user || !production) return;
    setFinishingMesh(true);
    setFinishMeshError(null);
    setFinishMeshProgress(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/order-items/${production.id}/finish-mesh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ wallThicknessMm, sphereSegments }),
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

  const modelSrc = production?.scaledModelUrl ?? item.modelUrl ?? undefined;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        アイテム{index + 1}：{item.subject}
        <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
          {item.sizeOption}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {modelSrc ? (
            <model-viewer
              src={modelSrc}
              alt="3Dモデル"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              3Dモデルなし
            </div>
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
        {item.furColorNote && <InfoRow label="毛色・柄" value={item.furColorNote} />}
        {item.breedNote && <InfoRow label="犬種・ミックス" value={item.breedNote} />}
        {item.accessoryNote && (
          <InfoRow label="服・首輪などの扱い" value={item.accessoryNote} />
        )}
        {item.bodyFeatureNote && (
          <InfoRow label="しっぽ・耳など体の特徴" value={item.bodyFeatureNote} />
        )}
        <InfoRow label="ポーズ" value={POSE_LABELS[item.pose]} />
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
                        : "あり（自動追加・底面中心）"
                    }
                  />
                  <a
                    href={production.finishedModelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-slate-800 underline underline-offset-2"
                  >
                    中空化済みSTLをダウンロード
                  </a>
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
      </div>

      {order.items.map((item, index) => (
        <ItemCard
          key={index}
          item={item}
          index={index}
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
