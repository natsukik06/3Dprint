"use client";

import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { colorImageSrc, colorLabel, defaultColorSettings, type ColorSettingsMap } from "@/lib/colorSettings";
import { DEFAULT_COLOR_IMAGE_SRC } from "@/lib/colorSwatches";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, POSE_LABELS } from "@/lib/pricing";
import {
  HARDWARE_COLOR_LABELS,
  MAGIC_COLOR_OPTIONS,
  SIZE_LABELS,
  SIZE_TARGET_MM,
  type OrderItemDraft,
  type SolidSizeOption,
} from "@/types/order";

type SheetOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  requestNote: string;
  items: OrderItemDraft[];
};

const VIEW_LABELS = ["正面", "左", "背面", "右"];

// One A4 sheet per item (= per "セットに追加" entry): everything the person making the piece needs to
// tell jobs apart at a glance -- the model's 4 views, the exact color swatch photo(s) with piece
// counts, size, engraving and hardware -- so nothing has to be cross-checked on another screen.
function ItemSheet({
  order,
  item,
  index,
  settings,
}: {
  order: SheetOrder;
  item: OrderItemDraft;
  index: number;
  settings: ColorSettingsMap;
}) {
  const colors = MAGIC_COLOR_OPTIONS.filter((c) => (item.colorQuantities[c] ?? 0) > 0);
  const totalPieces = colors.reduce((s, c) => s + (item.colorQuantities[c] ?? 0), 0);
  const sizeMm = SIZE_TARGET_MM[item.sizeOption as SolidSizeOption];
  const views = item.referenceImageUrls.slice(0, 4);

  return (
    <section className="sheet break-after-page border border-slate-300 bg-white p-5 print:border-0 print:p-0">
      <header className="mb-3 flex items-end justify-between gap-3 border-b-2 border-slate-900 pb-2">
        <div>
          <p className="text-xs text-slate-500">注文番号</p>
          <p className="text-3xl font-black tracking-wide text-slate-900">{order.orderNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">アイテム {index + 1}／{order.items.length}</p>
          <p className="text-lg font-bold text-slate-900">{item.subject}</p>
          <p className="text-xs text-slate-600">{order.customerName} 様</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-bold text-slate-500">モデルの画像</p>
          {views.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {views.map((url, i) => (
                <figure key={url} className="overflow-hidden rounded border border-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={VIEW_LABELS[i] ?? ""} className="aspect-square w-full bg-white object-contain" />
                  <figcaption className="bg-slate-100 py-0.5 text-center text-[10px] text-slate-600">
                    {VIEW_LABELS[i] ?? ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="rounded border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
              画像なし（お客様提供モデル／既製品）
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs font-bold text-slate-500">色・個数（合計 {totalPieces}個）</p>
            <div className="space-y-1.5">
              {colors.map((c) => {
                const src = colorImageSrc(settings, c, DEFAULT_COLOR_IMAGE_SRC[c]);
                return (
                  <div key={c} className="flex items-center gap-2 rounded border-2 border-slate-900 p-1.5">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                        写真なし
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-base font-bold leading-tight text-slate-900">
                        {colorLabel(settings, c, MAGIC_COLOR_LABELS[c])}
                      </p>
                      <p className="text-2xl font-black text-slate-900">× {item.colorQuantities[c]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <dl className="space-y-1 rounded bg-slate-50 p-2 text-sm text-slate-900">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">サイズ</dt>
              <dd className="font-bold">
                {SIZE_LABELS[item.sizeOption]}
                {sizeMm ? `（最大辺${sizeMm}mm）` : ""}
              </dd>
            </div>
            {item.subjectType !== "object" && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">ポーズ</dt>
                <dd>{POSE_LABELS[item.pose]}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">上の穴（金具）</dt>
              <dd className="text-right font-bold">
                {item.wantsHardware
                  ? `あり／${HARDWARE_COLOR_LABELS[item.hardwareColor]}${item.chainPositionNote ? `／${item.chainPositionNote}` : ""}`
                  : "なし"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">刻印</dt>
              <dd className="text-right font-bold">
                {item.wantsEngraving ? `「${item.engravingText}」（${item.engravingFont}）` : "なし"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {(item.furColorNote || item.accessoryNote || item.bodyFeatureNote || order.requestNote) && (
        <div className="mt-3 rounded border border-slate-300 p-2 text-xs text-slate-700">
          <p className="mb-0.5 font-bold text-slate-500">お客様のメモ</p>
          {item.furColorNote && <p>色・柄：{item.furColorNote}</p>}
          {item.accessoryNote && <p>服・首輪など：{item.accessoryNote}</p>}
          {item.bodyFeatureNote && <p>体の特徴：{item.bodyFeatureNote}</p>}
          {order.requestNote && <p className="whitespace-pre-wrap">ご要望：{order.requestNote}</p>}
        </div>
      )}

      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px] text-slate-700">
        {["造形", "洗浄・硬化", "金具・刻印", "色づけ・仕上げ", "梱包"].map((s) => (
          <label key={s} className="flex items-center justify-center gap-1 rounded border border-slate-400 py-1.5">
            <span className="inline-block h-3 w-3 border border-slate-700" />
            {s}
          </label>
        ))}
      </div>
    </section>
  );
}

function Sheets() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const [orders, setOrders] = useState<SheetOrder[] | null>(null);
  const [settings, setSettings] = useState<ColorSettingsMap>(defaultColorSettings());

  useEffect(() => {
    fetch("/api/color-settings")
      .then((r) => r.json())
      .then((s) => setSettings(s as ColorSettingsMap))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function toSheet(id: string, data: Record<string, unknown>): SheetOrder {
      return {
        id,
        orderNumber: (data.orderNumber as string) ?? id,
        customerName: (data.customerName as string) ?? "",
        requestNote: (data.requestNote as string) ?? "",
        items: (data.items as OrderItemDraft[]) ?? [],
      };
    }
    async function load() {
      if (orderId) {
        const snap = await getDoc(doc(db, "orders", orderId));
        setOrders(snap.exists() ? [toSheet(snap.id, snap.data())] : []);
        return;
      }
      const snap = await getDocs(
        query(collection(db, "orders"), where("paymentStatus", "==", "paid"), orderBy("createdAt", "asc"))
      );
      setOrders(snap.docs.filter((d) => !d.data().shipped).map((d) => toSheet(d.id, d.data())));
    }
    load().catch(() => setOrders([]));
  }, [orderId]);

  const itemCount = orders?.reduce((s, o) => s + o.items.length, 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <Link href="/admin" className="text-sm text-slate-600 underline underline-offset-2">
            ← 管理画面
          </Link>
          <h1 className="text-lg font-bold text-slate-900">作業シート</h1>
          <p className="text-xs text-slate-500">
            {orderId ? "この注文" : "支払い済み・未発送の注文すべて"}：{itemCount}枚（アイテムごとに1枚・A4）
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          印刷する
        </button>
      </div>
      {orders === null ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : itemCount === 0 ? (
        <p className="text-sm text-slate-500">対象の注文がありません。</p>
      ) : (
        <div className="space-y-4 print:space-y-0">
          {orders.flatMap((o) =>
            o.items.map((item, i) => (
              <ItemSheet key={`${o.id}-${i}`} order={o} item={item} index={i} settings={settings} />
            ))
          )}
        </div>
      )}
    </main>
  );
}

export default function SheetsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">読み込み中...</p>}>
      <Sheets />
    </Suspense>
  );
}
