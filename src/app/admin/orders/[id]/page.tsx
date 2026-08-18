"use client";

import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import {
  DELIVERY_TIME_SLOT_LABELS,
  MAGIC_COLOR_LABELS,
  POSE_LABELS,
  formatYen,
} from "@/lib/pricing";
import {
  MAGIC_COLOR_OPTIONS,
  ORDER_STATUS_LABELS,
  type BoundingBoxMm,
  type ColorQuantities,
  type DeliveryTimeSlot,
  type HolePoint,
  type MagicColor,
  type OrderStatus,
  type Pose,
  type SizeOption,
} from "@/types/order";

type OrderDetail = {
  referenceImageUrls: string[];
  modelUrl: string | null;
  finishedPreviewUrls: Partial<Record<MagicColor, string>>;
  subject: string;
  pose: Pose;
  colorQuantities: ColorQuantities;
  wantsHardware: boolean;
  holePosition: HolePoint | null;
  bottomHolePosition: HolePoint | null;
  bottomHoleDiameterMm: number | null;
  estimatedPriceYen: number;
  shippingYen: number;
  discountYen: number;
  customerName: string;
  customerEmail: string;
  postalCode: string;
  address: string;
  phoneNumber: string;
  deliveryDate: string | null;
  deliveryTimeSlot: DeliveryTimeSlot;
  requestNote: string;
  createdAt: { toDate: () => Date } | null;
  sizeOption: SizeOption;
  shippingMethod: string | null;
  scaledModelUrl: string | null;
  maxDimensionMm: number | null;
  scaledBoundingBoxMm: BoundingBoxMm | null;
  status: OrderStatus;
  batchId: string | null;
  gridId: string | null;
  finishedModelUrl: string | null;
  wallThicknessMm: number | null;
  hasVentHole: boolean;
  ventHoleSource: "auto" | "customer" | null;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function AdminOrderDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(
    undefined
  );
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [finishingMesh, setFinishingMesh] = useState(false);
  const [finishMeshError, setFinishMeshError] = useState<string | null>(null);

  async function fetchOrder(): Promise<OrderDetail | null> {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...(data as OrderDetail),
      referenceImageUrls: data.referenceImageUrls ?? [],
      finishedPreviewUrls: data.finishedPreviewUrls ?? {},
      colorQuantities: data.colorQuantities ?? {
        starryBlue: 0,
        galaxyGreen: 0,
        clearAurora: 0,
      },
      bottomHolePosition: data.bottomHolePosition ?? null,
      bottomHoleDiameterMm: data.bottomHoleDiameterMm ?? null,
      sizeOption: data.sizeOption ?? "S",
      shippingMethod: data.shippingMethod ?? null,
      scaledModelUrl: data.scaledModelUrl ?? null,
      maxDimensionMm: data.maxDimensionMm ?? null,
      scaledBoundingBoxMm: data.scaledBoundingBoxMm ?? null,
      status: data.status ?? "pending",
      batchId: data.batchId ?? null,
      gridId: data.gridId ?? null,
      finishedModelUrl: data.finishedModelUrl ?? null,
      wallThicknessMm: data.wallThicknessMm ?? null,
      hasVentHole: data.hasVentHole ?? false,
      ventHoleSource: data.ventHoleSource ?? null,
    };
  }

  useEffect(() => {
    let cancelled = false;
    fetchOrder().then((result) => {
      if (!cancelled) setOrder(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  async function handleReprocess() {
    if (!user) return;
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
        body: JSON.stringify({ orderId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "処理に失敗しました");
      setOrder(await fetchOrder());
    } catch (err) {
      setReprocessError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleFinishMesh() {
    if (!user) return;
    setFinishingMesh(true);
    setFinishMeshError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/orders/${id}/finish-mesh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "処理に失敗しました");
      setOrder(await fetchOrder());
    } catch (err) {
      setFinishMeshError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setFinishingMesh(false);
    }
  }

  if (order === undefined) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }
  if (order === null) {
    return <p className="text-sm text-slate-500">注文が見つかりません</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {order.scaledModelUrl || order.modelUrl ? (
            <model-viewer
              src={order.scaledModelUrl ?? order.modelUrl ?? undefined}
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
          {Object.values(order.finishedPreviewUrls)[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={Object.values(order.finishedPreviewUrls)[0]}
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

      {Object.keys(order.finishedPreviewUrls).length > 1 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">
            カラー別 完成イメージ
          </p>
          <div className="flex flex-wrap gap-2">
            {MAGIC_COLOR_OPTIONS.filter((c) => order.finishedPreviewUrls[c]).map(
              (color) => (
                <a
                  key={color}
                  href={order.finishedPreviewUrls[color]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1"
                >
                  <span className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.finishedPreviewUrls[color]}
                      alt={MAGIC_COLOR_LABELS[color]}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {MAGIC_COLOR_LABELS[color]}
                  </span>
                </a>
              )
            )}
          </div>
        </div>
      )}

      {(order.referenceImageUrls?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">参考写真</p>
          <div className="flex flex-wrap gap-2">
            {order.referenceImageUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="参考写真"
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow label="作りたいもの" value={order.subject} />
        <InfoRow label="ポーズ" value={POSE_LABELS[order.pose]} />
        <InfoRow
          label="カラー・個数"
          value={MAGIC_COLOR_OPTIONS.filter(
            (c) => (order.colorQuantities[c] ?? 0) > 0
          )
            .map((c) => `${MAGIC_COLOR_LABELS[c]} ×${order.colorQuantities[c]}`)
            .join(" / ")}
        />
        <InfoRow
          label="上の穴（金具用）"
          value={
            order.wantsHardware
              ? order.holePosition
                ? `あり（x=${order.holePosition.x.toFixed(2)}, y=${order.holePosition.y.toFixed(2)}, z=${order.holePosition.z.toFixed(2)}）`
                : "希望あり（位置未指定）"
              : "なし"
          }
        />
        <InfoRow
          label="下の穴（コルク用）"
          value={
            order.bottomHolePosition
              ? `x=${order.bottomHolePosition.x.toFixed(2)}, y=${order.bottomHolePosition.y.toFixed(2)}, z=${order.bottomHolePosition.z.toFixed(2)}（直径${order.bottomHoleDiameterMm ?? "-"}mm）`
              : "未指定"
          }
        />
        <InfoRow
          label="送料"
          value={order.shippingYen === 0 ? "無料" : formatYen(order.shippingYen)}
        />
        {order.discountYen > 0 && (
          <InfoRow label="割引" value={`-${formatYen(order.discountYen)}`} />
        )}
        <InfoRow label="合計金額" value={formatYen(order.estimatedPriceYen)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow label="サイズ" value={order.sizeOption} />
        <InfoRow label="配送方法" value={order.shippingMethod ?? "未処理"} />
        <InfoRow
          label="スケーリング後サイズ"
          value={order.maxDimensionMm ? `最大辺 ${order.maxDimensionMm.toFixed(1)}mm` : "未処理"}
        />
        <InfoRow label="ステータス" value={ORDER_STATUS_LABELS[order.status]} />
        <InfoRow
          label="バッチ/グリッド"
          value={order.batchId ? `${order.batchId} / ${order.gridId}` : "未割当"}
        />
        {!order.scaledModelUrl && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleReprocess}
              disabled={reprocessing || !order.modelUrl}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {reprocessing ? "処理中..." : "再スケーリング処理を実行"}
            </button>
            {reprocessError && (
              <p className="mt-1 text-xs text-red-600">{reprocessError}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow
          label="中空化・穴あけ"
          value={
            order.finishedModelUrl
              ? `完了（壁厚${order.wallThicknessMm ?? "-"}mm）`
              : "未処理"
          }
        />
        {order.finishedModelUrl && (
          <>
            <InfoRow
              label="通気穴"
              value={
                order.ventHoleSource === "customer"
                  ? "あり（顧客指定の金具穴/コルク穴を使用）"
                  : "あり（自動追加・底面中心）"
              }
            />
            <a
              href={order.finishedModelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-slate-800 underline underline-offset-2"
            >
              中空化済みSTLをダウンロード
            </a>
          </>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleFinishMesh}
            disabled={finishingMesh || (!order.scaledModelUrl && !order.modelUrl)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {finishingMesh
              ? "処理中..."
              : order.finishedModelUrl
                ? "中空化・穴あけを再実行"
                : "中空化・穴あけ処理を実行"}
          </button>
          {finishMeshError && (
            <p className="mt-1 text-xs text-red-600">{finishMeshError}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <InfoRow label="お名前" value={order.customerName} />
        <InfoRow label="メール" value={order.customerEmail} />
        <InfoRow label="電話番号" value={order.phoneNumber} />
        <InfoRow
          label="配送先"
          value={`〒${order.postalCode} ${order.address}`}
        />
        <InfoRow
          label="お届け希望日"
          value={order.deliveryDate || "指定なし"}
        />
        <InfoRow
          label="お届け希望時間帯"
          value={DELIVERY_TIME_SLOT_LABELS[order.deliveryTimeSlot]}
        />
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
    <AdminGate>
      <div className="min-h-full bg-slate-50">
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
      </div>
    </AdminGate>
  );
}
