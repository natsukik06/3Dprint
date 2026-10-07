"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LikeButton } from "@/components/home/LikeButton";
import { optimizedImageUrl } from "@/lib/imageUrl";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { displayFont as display, zenGothic, zenMincho } from "@/lib/fonts";
import { CHARO_PREMADE_MODEL } from "@/lib/premadeModels";
import {
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  SHIPPING_FEE_YEN,
  SOLID_PRICE_YEN,
} from "@/lib/pricing";
import { SIZE_TARGET_MM } from "@/types/order";
import { CREDIT_PRICE_YEN } from "@/lib/creditPacks";

// `image: null` renders a "準備中" placeholder tile instead of a broken <Image> -- for lineup
// items that are decided but don't have a product photo yet. Swap in a real path (and drop the
// null case) once one exists.
const COMING_SOON: { id: string; name: string; image: string | null }[] = [
  { id: "photo-stand", name: "写真スタンド", image: null },
  { id: "cord-stopper", name: "コード止め", image: null },
];

// The real, currently-orderable sizes (AVAILABLE_SIZE_OPTIONS -- keep in step with it) and their prices -- pulled straight from pricing.ts /
// types/order.ts (not re-typed here) so this list can never silently drift from what /order
// actually charges.
const PRICE_LIST: { key: string; label: string; note: string; priceLabel: string }[] = [
  {
    key: "solid20",
    label: "20mmサイズ",
    note: `最大辺${SIZE_TARGET_MM.solid20}mm・中実`,
    priceLabel: `¥${SOLID_PRICE_YEN.solid20.toLocaleString()}`,
  },
  {
    key: "solid30",
    label: "30mmサイズ",
    note: `最大辺${SIZE_TARGET_MM.solid30}mm・中実`,
    priceLabel: `¥${SOLID_PRICE_YEN.solid30.toLocaleString()}`,
  },
  {
    key: "solid35",
    label: "35mmサイズ",
    note: `最大辺${SIZE_TARGET_MM.solid35}mm・中実`,
    priceLabel: `¥${SOLID_PRICE_YEN.solid35.toLocaleString()}`,
  },
  {
    key: "solid40",
    label: "40mmサイズ",
    note: `最大辺${SIZE_TARGET_MM.solid40}mm・中実`,
    priceLabel: `¥${SOLID_PRICE_YEN.solid40.toLocaleString()}`,
  },
];

export default function ProductsPage() {
  return (
    <div
      className={`${zenGothic.variable} ${zenMincho.variable} min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]`}
      style={{ fontFamily: "var(--font-zen-gothic), sans-serif" }}
    >
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8 lg:py-16">
        <header className="mb-10 text-center">
          <span
            className="mb-3 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
            style={display}
          >
            PRICE & LINEUP
          </span>
          <h1 className="text-2xl font-semibold leading-relaxed lg:text-3xl" style={display}>
            料金・ラインナップ
          </h1>
        </header>

        {/* PRICE */}
        <section id="price" className="scroll-mt-6 pb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8a5a34] dark:text-[#7fd8cb]">
              Price
            </h2>
            <span className="text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
              全{PRICE_LIST.length}サイズ・税込
            </span>
          </div>
          <div className="divide-y divide-[#e0d3b8] overflow-hidden rounded-2xl border border-[#d9cbb0] bg-white dark:divide-[#232726] dark:border-[#232726] dark:bg-[#121415]">
            {PRICE_LIST.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs text-[#8a7c5e] dark:text-[#6d7c79]">{row.note}</p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">{row.priceLabel}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#8a7c5e] dark:text-[#6d7c79]">
            送料は¥{SHIPPING_FEE_YEN.toLocaleString()}(商品代金合計¥
            {FREE_SHIPPING_SUBTOTAL_YEN.toLocaleString()}
            以上で無料)。ストラップ・キーホルダー用金具穴の追加は+¥
            {HARDWARE_ADDON_PRICE_YEN.toLocaleString()}/個(任意)。
          </p>
        </section>

        {/* SHOP / LINEUP */}
        <section id="shop" className="scroll-mt-6 pb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8a5a34] dark:text-[#7fd8cb]">
              Lineup
            </h2>
            <span className="rounded-full bg-[#fff1d6] px-3 py-1 text-xs font-bold text-[#9a5b00] dark:bg-[#3a2f16] dark:text-[#f0c36b]">
              準備中 {COMING_SOON.length}種
            </span>
          </div>
          <p className="mb-3 rounded-lg border border-[#e8d7a8] bg-[#fffaf0] px-3 py-2 text-xs leading-relaxed text-[#6b5c40] dark:border-[#3a2f16] dark:bg-[#1c1810] dark:text-[#cdbb8a]">
            点線で囲んだ「<b>準備中</b>」の商品は、まだ販売していません（まだ注文できません）。発売まで、もうしばらくお待ちください。ご注文いただけるのは「販売中」の商品です。
          </p>
          <div className="grid grid-cols-3 gap-3 lg:gap-5">
            <Link
              href="/order"
              className="overflow-hidden rounded-xl border border-[#d9cbb0] bg-white transition-opacity hover:opacity-90 dark:border-[#232726] dark:bg-[#121415]"
            >
              <div className="relative aspect-square">
                <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[#0f766e] px-2 py-0.5 text-[9px] font-bold text-white dark:bg-[#7fd8cb]/20 dark:text-[#a9ece2] dark:ring-1 dark:ring-[#7fd8cb]/40">
                  既製品・生成不要
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL, not a local/next.config-whitelisted remote domain */}
                <img
                  src={CHARO_PREMADE_MODEL.renderedImageUrl ? optimizedImageUrl(CHARO_PREMADE_MODEL.renderedImageUrl, 384) : undefined}
                  alt="ちゃろ（既製フィギュア）"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] leading-tight">ちゃろ</p>
                <p className="text-xs font-bold tabular-nums">
                  ¥{SOLID_PRICE_YEN.solid20.toLocaleString()}〜
                </p>
              </div>
            </Link>

            <div className="overflow-hidden rounded-xl border border-[#d9cbb0] bg-white dark:border-[#232726] dark:bg-[#121415]">
              <div className="relative aspect-square">
                <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[#0f766e] px-2 py-0.5 text-[9px] font-bold text-white dark:bg-[#7fd8cb]/20 dark:text-[#a9ece2] dark:ring-1 dark:ring-[#7fd8cb]/40">
                  販売中
                </span>
                <LikeButton productId="keychain-s" />
                <Image
                  src="/photos/kansei-side.jpg"
                  alt="クリアレジンのキーホルダー（実際の商品・小サイズ）"
                  fill
                  sizes="(min-width: 1024px) 33vw, 30vw"
                  className="object-cover"
                />
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] leading-tight">キーホルダー（小）</p>
                <p className="text-xs font-bold tabular-nums">
                  ¥{SOLID_PRICE_YEN.solid20.toLocaleString()}〜
                </p>
              </div>
            </div>

            {COMING_SOON.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-dashed border-[#d9cbb0] dark:border-[#2c3230]"
              >
                <div className="relative aspect-square">
                  <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[#fff1d6] px-2 py-0.5 text-[11px] font-bold text-[#9a5b00] dark:bg-[#3a2f16] dark:text-[#f0c36b]">
                    準備中
                  </span>
                  <LikeButton productId={item.id} />
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, 30vw"
                      className="object-cover grayscale opacity-70"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#efe7d4] dark:bg-white/5">
                      <Camera className="h-6 w-6 text-[#c3b592] dark:text-[#4a524e]" strokeWidth={1.5} />
                      <span className="text-[9px] text-[#a89b7d] dark:text-[#586360]">写真準備中</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] leading-tight text-[#8a7c5e] dark:text-[#6d7c79]">
                    {item.name}
                  </p>
                  <p className="text-xs text-[#9a5b00] dark:text-[#f0c36b]">準備中・まだ注文できません</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-2 text-center">
          <p className="mb-2 text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
            ①写真から4方向のイメージを作る工程は1日6回まで無料、②3Dモデルを作る工程は1回¥{CREDIT_PRICE_YEN}（初回は無料）で、仕上がりを確認してからご注文をご検討いただけます
          </p>
          <Link
            href="/order"
            className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
          >
            注文する
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
