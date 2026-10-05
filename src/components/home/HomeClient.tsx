"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import {
  DUO_COMPOSITIONS,
  SINGLE_COMPOSITIONS,
  type CompositionKind,
  type CompositionPreset,
} from "@/lib/compositions";
import { zenGothic, zenMincho, displayFont as display } from "@/lib/fonts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AuthNavButton } from "@/components/site/AuthNavButton";
import { CREDIT_PRICE_YEN, GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN } from "@/lib/creditPacks";

// "ちゃろができるまで" -- one real sample photo (public/sample-photo-chi.jpg) run through the actual
// pipeline twice, once per model style: 4-direction views -> 3D model render. Permanently hosted
// in Storage (previews/charo-howto-*), distinct from CHARO_PREMADE_MODEL.
const HOW_IT_WORKS = {
  deformed: {
    front:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-deformed-front.png?alt=media&token=8e63ecd1-1fb2-4b4a-b905-edcc09d0f733",
    left:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-deformed-left.png?alt=media&token=3da73831-f53f-4d9e-a360-8f5dad308f5b",
    back:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-deformed-back.png?alt=media&token=cd6d9667-b644-4979-8b1f-6905e455f990",
    right:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-deformed-right.png?alt=media&token=654bbd2e-467f-43d8-8cb3-5ffa83411459",
    model3d:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-deformed-3d.png?alt=media&token=c4d7eec9-9feb-417d-b3f6-31bddad015ed",
  },
  real: {
    front:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-real-front.png?alt=media&token=a8d2799c-7dcc-41c3-bf31-82f787a221a9",
    left:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-real-left.png?alt=media&token=6e073141-f28f-4ca0-9348-78bad25beced",
    back:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-real-back.png?alt=media&token=ce5983cc-5f98-488d-b740-9eea27a4fd82",
    right:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-real-right.png?alt=media&token=11320560-deaf-41be-ac45-2916cad0d49a",
    model3d:
      "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-howto-real-3d.png?alt=media&token=15eeb893-2a70-4a4c-aa34-b449b8718a5a",
  },
};

// One square card of the composition picker. Shows the showcase photo when it exists and falls back
// to the plain composition icon when it does not (or fails to load).
function CompositionCard({ preset }: { preset: CompositionPreset }) {
  const [useIcon, setUseIcon] = useState(false);
  return (
    <Link
      href={`/order?composition=${preset.id}`}
      className="group block overflow-hidden rounded-2xl border border-[#d9cbb0] bg-white transition-colors hover:border-[#0f766e] dark:border-[#232726] dark:bg-[#121415] dark:hover:border-[#7fd8cb]"
    >
      <div className="aspect-square overflow-hidden bg-[#f4ecdc] dark:bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element -- showcase image may not exist yet; onError falls back to the icon */}
        <img
          src={useIcon ? preset.imageUrl : preset.showcaseUrl}
          alt={`${preset.label}の見本`}
          loading="lazy"
          ref={(el) => {
            // The 404 can land before hydration, when onError is not attached yet.
            if (el && el.complete && el.naturalWidth === 0) setUseIcon(true);
          }}
          onError={() => setUseIcon(true)}
          className={`h-full w-full transition-transform group-hover:scale-105 ${
            useIcon ? "object-contain p-4" : "object-cover"
          }`}
        />
      </div>
      <div className="px-2.5 py-2.5 text-center">
        <p className="text-sm font-semibold leading-tight">{preset.label}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-[#6b5c40] dark:text-[#9fb0ae]">
          {preset.catchCopy}
        </p>
      </div>
    </Link>
  );
}

// `showcase` is the server-rendered 作成例 section (HomeShowcaseSection) -- passed in as a slot
// because this component is a client component and cannot fetch from firebase-admin itself.
export function HomeClient({ showcase }: { showcase?: ReactNode }) {
  const [compositionKind, setCompositionKind] = useState<CompositionKind>("single");
  const shownCompositions =
    compositionKind === "single" ? SINGLE_COMPOSITIONS : DUO_COMPOSITIONS;
  return (
    <div
      className={`${zenGothic.variable} ${zenMincho.variable} min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]`}
      style={{ fontFamily: "var(--font-zen-gothic), sans-serif" }}
    >
      {/* HERO */}
      <header className="relative flex h-[100svh] min-h-[560px] items-center justify-center overflow-hidden text-center text-[#f3ece0]">
        <video
          src="/hero-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover brightness-[0.55]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,6,0.35) 0%, rgba(5,6,6,0.15) 40%, rgba(5,6,6,0.78) 100%)",
          }}
        />

        <nav className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-xl items-center justify-between px-4 py-5 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8 lg:py-7">
          <Image
            src="/logo-charo3d-v2.png"
            alt="Charo 3D"
            width={938}
            height={1004}
            priority
            className="h-10 w-auto invert sm:h-11 lg:h-14"
          />
          <div className="flex items-center gap-2.5 whitespace-nowrap text-[11px] font-medium text-[#f3ece0]/90 sm:gap-4 sm:text-xs lg:gap-6 lg:text-sm">
            <Link href="/products" className="hover:text-white">
              料金
            </Link>
            <Link href="/story" className="hidden hover:text-white sm:inline">
              ものがたり
            </Link>
            <Link href="/guide/faq" className="hidden hover:text-white sm:inline">
              よくある質問
            </Link>
            <AuthNavButton className="hover:text-white" />
            <Link
              href="/order"
              className="rounded-full bg-[#7fd8cb] px-3 py-1.5 text-[#08211d] transition-colors hover:bg-[#9fe6da] sm:px-4 sm:py-2 lg:px-5 lg:py-2.5"
            >
              注文する
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-lg px-6">
          <span
            className="mb-4 block text-xs italic tracking-[0.22em] text-[#bfe8e0]"
            style={display}
          >
            PET KEEPSAKE ATELIER
          </span>
          <h1
            className="text-3xl font-semibold leading-[1.5] sm:text-4xl lg:text-5xl"
            style={display}
          >
            そばにいなくても、
            <br />
            そばにいる。
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-8 text-[#d8d2c4] sm:text-base">
            愛犬・愛猫の写真から、世界にひとつのクリスタルキーホルダーを。
            <br className="hidden sm:block" />
            ひとつずつ、手のひらの上で仕上げています。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/products"
              className="rounded-full bg-[#7fd8cb] px-8 py-3 text-sm font-bold text-[#08211d] shadow-[0_10px_30px_-12px_rgba(127,216,203,0.6)] transition-transform hover:-translate-y-0.5"
            >
              料金・ラインナップを見る
            </Link>
            <Link
              href="/story"
              className="rounded-full border border-white/40 px-8 py-3 text-sm font-bold text-[#f3ece0] transition-colors hover:border-white"
            >
              ものがたりを見る
            </Link>
          </div>
        </div>

        <div
          aria-hidden
          className="absolute bottom-7 left-1/2 z-10 h-11 w-px -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.7), rgba(255,255,255,0.05))",
          }}
        />
      </header>

      <main>
        {/* PICK A COMPOSITION -- choosing a card jumps straight to /order?composition=<id>, which
            opens the matching creation mode with that composition preselected. */}
        <section className="border-t border-[#d9cbb0] py-16 dark:border-[#1c1f1e] sm:py-20">
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
            <div className="mb-6 text-center">
              <span
                className="mb-2 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
                style={display}
              >
                PICK A POSE
              </span>
              <h2 className="text-2xl font-semibold leading-relaxed" style={display}>
                構図から選んで作る
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
                気に入った構図を選ぶ → 写真を送る → 4方向で確認
              </p>
            </div>

            <div
              role="tablist"
              aria-label="何匹で作るか"
              className="mx-auto mb-5 grid max-w-xs grid-cols-2 gap-1 rounded-full border border-[#d9cbb0] bg-white/70 p-1 dark:border-[#232726] dark:bg-[#121415]"
            >
              {(
                [
                  ["single", "1匹で作る"],
                  ["duo", "2匹で作る"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={compositionKind === kind}
                  onClick={() => setCompositionKind(kind)}
                  className={`rounded-full py-2.5 text-sm font-semibold transition-colors ${
                    compositionKind === kind
                      ? "bg-[#0f766e] text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]"
                      : "text-[#6b5c40] hover:text-[#3f3424] dark:text-[#9fb0ae] dark:hover:text-[#eef2f1]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {shownCompositions.map((preset) => (
                <CompositionCard key={preset.id} preset={preset} />
              ))}
            </div>
          </div>
        </section>

        {/* 作成例 -- server-rendered, renders nothing when no example is published for the home. */}
        {showcase}

        {/* HOW IT'S MADE -- shows the AI generation pipeline using the brand mascot's own real
            pipeline on one sample photo (see HOW_IT_WORKS above), in both model styles side by
            side, right up front before anyone commits to uploading their own photo. */}
        <div className="border-t border-[#d9cbb0] bg-white/60 py-16 dark:border-[#1c1f1e] dark:bg-white/[0.02] sm:py-20">
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
            <div className="mb-10 text-center">
              <span
                className="mb-2 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
                style={display}
              >
                HOW IT&apos;S MADE
              </span>
              <h2 className="text-2xl font-semibold leading-relaxed" style={display}>
                ちゃろができるまで
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
                写真いちまいから、世界にひとつだけの透きとおる結晶フィギュアへ。1枚の見本写真を例に、「かわいいトイ調」と「写真そのまま」の2つの仕上がりをご紹介します。
              </p>
            </div>

            {/* Shared source photo, then the same photo run through the pipeline twice (two columns). */}
            <div className="mx-auto w-28 sm:w-32">
              <div className="aspect-square overflow-hidden rounded-xl border border-[#d9cbb0] bg-[#f4ecdc] dark:border-[#232726] dark:bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sample-photo-chi.jpg" alt="見本の写真：チワワ" className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 text-center text-xs font-semibold">
                <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-[11px] font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  1
                </span>
                写真を送るだけ
              </p>
            </div>

            <div className="mt-2 flex justify-center text-[#8a5a34] dark:text-[#7fd8cb]" aria-hidden="true">
              ▼
            </div>

            <div className="mx-auto mt-2 grid max-w-md grid-cols-2 gap-3 sm:max-w-xl sm:gap-5">
              {(
                [
                  { key: "deformed", title: "かわいいトイ調", note: "丸くてかわいい、ぬいぐるみ風", alt: "デフォルメ" },
                  { key: "real", title: "写真そのまま", note: "毛並みまでそのまま再現", alt: "リアル" },
                ] as const
              ).map((col) => (
                <div
                  key={col.key}
                  className="rounded-2xl border border-[#d9cbb0] bg-white p-2.5 dark:border-[#232726] dark:bg-[#121415] sm:p-4"
                >
                  <p className="text-center text-sm font-semibold">{col.title}</p>
                  <p className="mt-0.5 min-h-8 text-center text-[11px] leading-4text-[#6b5c40] dark:text-[#9fb0ae]">
                    {col.note}
                  </p>

                  <p className="mt-3 text-xs font-semibold">
                    <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-[11px] font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                      2
                    </span>
                    4方向のイメージ
                  </p>
                  <div className="mt-1.5 grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-[#f4ecdc] dark:bg-white/5">
                    {(["front", "left", "back", "right"] as const).map((view) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={view}
                        src={HOW_IT_WORKS[col.key][view]}
                        alt={`${col.alt} ${view === "front" ? "正面" : view === "left" ? "左側面" : view === "back" ? "背面" : "右側面"}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ))}
                  </div>

                  <div className="my-1.5 text-center text-xs text-[#8a5a34] dark:text-[#7fd8cb]" aria-hidden="true">
                    ▼
                  </div>

                  <p className="text-xs font-semibold">
                    <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-[11px] font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                      3
                    </span>
                    3Dモデル
                  </p>
                  <div className="mt-1.5 aspect-square overflow-hidden rounded-lg bg-white dark:bg-white/90">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={HOW_IT_WORKS[col.key].model3d}
                      alt={`${col.alt}の3Dモデル`}
                      loading="lazy"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#d9cbb0] bg-white p-4 text-center dark:border-[#232726] dark:bg-[#121415]">
              <span className="rounded-full bg-[#f4ecdc] px-2 py-0.5 text-[10px] font-bold text-[#8a5a34] dark:bg-white/10 dark:text-[#e8c98a]">
                ¥{CREDIT_PRICE_YEN}/回
              </span>
              <p className="mt-2 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                写真から4方向のイメージを描き、形がイメージと合うか確認できます（作り直しは無料）。そのイメージから3Dモデルを作ります。3D化には¥{CREDIT_PRICE_YEN}かかります（初回は無料クレジット付き）。
              </p>
              <p className="mt-1.5 inline-block rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                ✓ 商品代金が{GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN.toLocaleString()}円以上のご注文なら、かかった分（最大2回分）が割引されます
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
              ※実際のご注文では、あなたの大切な子の写真を使って同じ工程で作ります（上の例は見本の写真を使用しています）
            </p>
          </div>
        </div>

        {/* Quick links -- the two things a first-time visitor actually needs right after the
            hero: what it costs / what's on offer, and the story behind it. Kept short on purpose
            so this doesn't turn back into the long single-scroll page this replaced. */}
        <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/products"
              className="group rounded-2xl border border-[#d9cbb0] bg-white/70 p-6 transition-colors hover:border-[#0f766e] dark:border-[#232726] dark:bg-[#121415] dark:hover:border-[#7fd8cb]"
            >
              <span
                className="mb-2 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
                style={display}
              >
                PRICE & LINEUP
              </span>
              <h2 className="text-xl font-semibold leading-relaxed" style={display}>
                料金・ラインナップ
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
                全3サイズの価格と、今作れるもの・近日公開のラインナップをまとめて見られます。
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-[#0f766e] group-hover:underline dark:text-[#7fd8cb]">
                見てみる →
              </span>
            </Link>
            <Link
              href="/story"
              className="group rounded-2xl border border-[#d9cbb0] bg-white/70 p-6 transition-colors hover:border-[#0f766e] dark:border-[#232726] dark:bg-[#121415] dark:hover:border-[#7fd8cb]"
            >
              <span
                className="mb-2 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
                style={display}
              >
                THE STORY
              </span>
              <h2 className="text-xl font-semibold leading-relaxed" style={display}>
                ものがたり・こだわり
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
                一枚の写真がひとつだけの石になるまでの工程と、一人で手作りしていることへのこだわりです。
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-[#0f766e] group-hover:underline dark:text-[#7fd8cb]">
                読んでみる →
              </span>
            </Link>
          </div>

          <div className="mt-10 text-center">
            <p className="mb-2 text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
              ①写真から4方向のイメージを作る工程は1日2回まで無料、②3Dモデルを作る工程は1回¥{CREDIT_PRICE_YEN}（初回は無料）で、仕上がりを確認してからご注文をご検討いただけます
            </p>
            <Link
              href="/order"
              className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
            >
              注文する
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
