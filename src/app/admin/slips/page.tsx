"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  doc,
} from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS, formatYen } from "@/lib/pricing";
import type { OrderItemDraft } from "@/types/order";
import styles from "./print.module.css";

type SlipOrder = {
  id: string;
  customerName: string;
  items: OrderItemDraft[];
  estimatedPriceYen: number;
  createdAt: { toDate: () => Date } | null;
  insertPrinted: boolean;
};

function summarizeItem(item: OrderItemDraft): string {
  const colors = Object.entries(item.colorQuantities)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as keyof typeof MAGIC_COLOR_LABELS]}×${qty}`)
    .join("・");
  return `${item.subject}（${item.sizeOption}） ${colors}`;
}

function Sheet({ order }: { order: SlipOrder }) {
  return (
    <div className={styles.sheet}>
      <div style={{ textAlign: "center", marginBottom: "8mm" }}>
        <Image
          src="/logo-full.png"
          alt="LUMINA CHARO"
          width={1569}
          height={1034}
          style={{ width: "38mm", height: "auto", margin: "0 auto" }}
        />
      </div>

      <p style={{ textAlign: "center", fontSize: "13pt", fontWeight: 700, margin: "0 0 4mm" }}>
        この度はお迎えいただきありがとうございます
      </p>
      <p style={{ textAlign: "center", fontSize: "9pt", color: "#6b5c40", margin: "0 0 8mm" }}>
        世界にひとつの、あなただけのお守りです
      </p>

      <div
        style={{
          border: "1px solid #ddceac",
          borderRadius: "3mm",
          padding: "5mm",
          fontSize: "9pt",
          lineHeight: 1.8,
          marginBottom: "7mm",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>{order.customerName} 様</p>
        <p style={{ margin: 0, color: "#6b5c40" }}>
          ご注文日：{order.createdAt?.toDate().toLocaleDateString("ja-JP") ?? "-"}
          　注文番号：{order.id.slice(0, 8)}
        </p>
        <div style={{ marginTop: "3mm" }}>
          {order.items.map((item, i) => (
            <p key={i} style={{ margin: 0 }}>
              ・{summarizeItem(item)}
            </p>
          ))}
        </div>
        <p style={{ margin: "3mm 0 0", fontWeight: 700, textAlign: "right" }}>
          合計 {formatYen(order.estimatedPriceYen)}
        </p>
      </div>

      <div style={{ fontSize: "8pt", lineHeight: 1.8, color: "#6b5c40" }}>
        <p style={{ margin: "0 0 2mm", fontWeight: 700, color: "#8a5a34" }}>
          お取り扱いについて
        </p>
        <p style={{ margin: "0 0 4mm" }}>
          レジン製のため、高温・直射日光の当たる場所は避けて保管してください。落下・強い衝撃で割れる場合があります。
        </p>
        <p style={{ margin: "0 0 2mm", fontWeight: 700, color: "#8a5a34" }}>
          暗闇で光らせるには
        </p>
        <p style={{ margin: "0 0 4mm" }}>
          蓄光素材入りの色は、明るい場所やスマホのライトを数十秒当ててから電気を消すと、やさしく発光します（毛入れ用を除く）。
        </p>
        <p style={{ margin: "0 0 2mm", fontWeight: 700, color: "#8a5a34" }}>
          毛入れ用をお選びの方へ
        </p>
        <p style={{ margin: 0 }}>
          底面の穴からピンセットで少しずつ毛を詰め、最後にコルク栓で蓋をしてください。
        </p>
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "6mm",
          borderTop: "1px dashed #ddceac",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5mm",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/instagram-qr.png" alt="Instagram QRコード" style={{ width: "22mm", height: "22mm" }} />
        <div style={{ fontSize: "8pt", color: "#6b5c40" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Instagramはじめました</p>
          <p style={{ margin: 0 }}>@lumina_charo</p>
          <p style={{ margin: 0 }}>完成品の写真、お待ちしています</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminSlipsPage() {
  const [orders, setOrders] = useState<SlipOrder[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printQueue, setPrintQueue] = useState<SlipOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("paymentStatus", "==", "paid"),
          orderBy("createdAt", "desc")
        )
      );
      if (cancelled) return;
      setOrders(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            customerName: data.customerName ?? "",
            items: (data.items ?? []) as OrderItemDraft[],
            estimatedPriceYen: data.estimatedPriceYen ?? 0,
            createdAt: data.createdAt ?? null,
            insertPrinted: data.insertPrinted ?? false,
          };
        })
      );
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePrintSelected() {
    if (!orders || selected.size === 0) return;
    setError(null);
    const targets = orders.filter((o) => selected.has(o.id));
    setPrintQueue(targets);

    try {
      const batch = writeBatch(db);
      for (const order of targets) {
        batch.update(doc(db, "orders", order.id), { insertPrinted: true });
      }
      await batch.commit();
      setOrders((prev) =>
        prev
          ? prev.map((o) =>
              selected.has(o.id) ? { ...o, insertPrinted: true } : o
            )
          : prev
      );
      setSelected(new Set());
      setTimeout(() => window.print(), 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : "印刷済みの更新に失敗しました");
    }
  }

  if (orders === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </main>
    );
  }

  const unprinted = orders.filter((o) => !o.insertPrinted);
  const printed = orders.filter((o) => o.insertPrinted);

  return (
    <>
      <main className={`mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 ${styles.noPrint}`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="mb-1 inline-block text-sm text-slate-600 underline underline-offset-2"
            >
              ← 注文一覧に戻る
            </Link>
            <h1 className="text-xl font-bold text-slate-900">同梱シート印刷</h1>
          </div>
          <button
            type="button"
            onClick={handlePrintSelected}
            disabled={selected.size === 0}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            選択した注文をまとめて印刷（{selected.size}件）
          </button>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            未印刷（{unprinted.length}件）
          </h2>
          {unprinted.length === 0 ? (
            <p className="text-sm text-slate-500">未印刷の注文はありません</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {unprinted.map((order) => (
                <label
                  key={order.id}
                  className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggle(order.id)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {order.customerName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {order.items.map(summarizeItem).join(" / ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {order.createdAt?.toDate().toLocaleDateString("ja-JP") ?? ""}
                  </p>
                </label>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            印刷済み（{printed.length}件）
          </h2>
          {printed.length === 0 ? (
            <p className="text-sm text-slate-500">まだありません</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
              {printed.map((order) => (
                <div key={order.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-600">
                      {order.customerName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {order.items.map(summarizeItem).join(" / ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-emerald-600">✓ 印刷済み</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className={styles.printSheets}>
        {printQueue.map((order) => (
          <Sheet key={order.id} order={order} />
        ))}
      </div>
    </>
  );
}
