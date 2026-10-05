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
import { CHARO_PREMADE_MODEL } from "@/lib/premadeModels";

// "ちゃろができるまで" -- illustrates the AI generation pipeline using the brand mascot's own
// real generation history as the example (see src/lib/premadeModels.ts for how Charo itself was
// made). The 4-direction turnaround shots are a separate, permanently-hosted set (monochrome
// "white clay" style, generated straight from the logo) -- distinct from CHARO_PREMADE_MODEL's
// own finishedPreviewUrls, which is shown in the last step.
const HOW_IT_WORKS_VIEWS = {
  front:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-front.png?alt=media&token=69b13389-cf2c-4da3-ba13-213d54b7c657",
  left: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-left.png?alt=media&token=45c374c2-72ef-40f3-b944-5c0e75079083",
  back: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-back.png?alt=media&token=8645c9ff-21a3-49b6-ac06-54bd55854456",
  right:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-right.png?alt=media&token=08d507a1-550f-4097-971e-1cd427aac8c7",
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
            generation history (see HOW_IT_WORKS_VIEWS / CHARO_PREMADE_MODEL above) as a concrete,
            already-made example, right up front before anyone commits to uploading their own
            photo. */}
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
                写真いちまいから、世界にひとつだけの透きとおる結晶フィギュアへ。ブランドマスコット「ちゃろ」を例に、3つの工程をご紹介します。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  1
                </span>
                <div className="aspect-square overflow-hidden rounded-xl bg-[#f4ecdc] dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- site logo, but this row also renders Firebase-hosted images, so kept consistent as plain img */}
                  <img
                    src="/sample-photo-chi.jpg"
                    alt="見本の写真：チワワ"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">写真を送るだけ</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  お気に入りの一枚でOK。正面から全身が写った、明るい写真がおすすめです。
                </p>
              </div>


              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  2
                </span>
                <div className="grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-[#f4ecdc] dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={HOW_IT_WORKS_VIEWS.front} alt="正面スケッチ" className="h-full w-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={HOW_IT_WORKS_VIEWS.left} alt="左側面スケッチ" className="h-full w-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={HOW_IT_WORKS_VIEWS.back} alt="背面スケッチ" className="h-full w-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={HOW_IT_WORKS_VIEWS.right} alt="右側面スケッチ" className="h-full w-full object-cover" />
                </div>
                <p className="mt-3 text-sm font-semibold">写真から4方向をスケッチ</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  お送りいただいた写真をもとに、AIが正面・左右・背面をまとめて描き上げます。形がイメージと合うか、ここで確認できます（作り直しは無料）。
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                    3
                  </span>
                  <span className="rounded-full bg-[#f4ecdc] px-2 py-0.5 text-[10px] font-bold text-[#8a5a34] dark:bg-white/10 dark:text-[#e8c98a]">
                    ¥{CREDIT_PRICE_YEN}/回
                  </span>
                </div>
                <div className="aspect-square overflow-hidden rounded-xl bg-[#f4ecdc] dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CHARO_PREMADE_MODEL.renderedImageUrl ?? undefined}
                    alt="完成した3Dモデル"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">3Dモデルが誕生！</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  4方向のスケッチから、ほんものの3Dモデルが立ち上がります。3D化には¥{CREDIT_PRICE_YEN}かかります（初回は無料クレジット付き）。
                </p>
                <p className="mt-1.5 inline-block rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                  ✓ 商品代金が{GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN.toLocaleString()}円以上のご注文なら、かかった分（最大2回分）が割引されます
                </p>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
              ※実際のご注文では、あなたの大切な子の写真を使って同じ工程で作ります（上の例ではロゴを使用しました）
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
