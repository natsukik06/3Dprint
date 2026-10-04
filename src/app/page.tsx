"use client";

import Link from "next/link";
import Image from "next/image";
import { zenGothic, zenMincho, displayFont as display } from "@/lib/fonts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AuthNavButton } from "@/components/site/AuthNavButton";
import { CREDIT_PRICE_YEN, GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN } from "@/lib/creditPacks";
import { CHARO_PREMADE_MODEL } from "@/lib/premadeModels";

// "ちゃろができるまで" -- illustrates the AI generation pipeline using the brand mascot's own
// real generation history as the example (see src/lib/premadeModels.ts for how Charo itself was
// made). The 4-direction turnaround shots are a separate, permanently-hosted set (monochrome
// "white clay" style, generated straight from the logo) -- distinct from CHARO_PREMADE_MODEL's
// own finishedPreviewUrls, which are the color completions shown in step 2/4.
const HOW_IT_WORKS_VIEWS = {
  front:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-front.png?alt=media&token=69b13389-cf2c-4da3-ba13-213d54b7c657",
  left: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-left.png?alt=media&token=45c374c2-72ef-40f3-b944-5c0e75079083",
  back: "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-back.png?alt=media&token=8645c9ff-21a3-49b6-ac06-54bd55854456",
  right:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-whiteclay-mono-right.png?alt=media&token=08d507a1-550f-4097-971e-1cd427aac8c7",
};

export default function Home() {
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
            src="/logo-full.png"
            alt="LUMINA CHARO"
            width={1569}
            height={1034}
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
                写真いちまいから、世界にひとつだけの透きとおる結晶フィギュアへ。ブランドマスコット「ちゃろ」を例に、4つの工程をご紹介します。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  1
                </span>
                <div className="aspect-square overflow-hidden rounded-xl bg-[#f4ecdc] dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- site logo, but this row also renders Firebase-hosted images, so kept consistent as plain img */}
                  <img
                    src="/logo-full.png"
                    alt="参考写真：ちゃろのロゴ"
                    className="h-full w-full object-contain p-6"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">写真を送るだけ</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  お気に入りの一枚でOK。今回は「ちゃろ」のロゴを参考写真にしました。
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  2
                </span>
                <div className="aspect-square overflow-hidden rounded-xl bg-[#f4ecdc] dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CHARO_PREMADE_MODEL.finishedPreviewUrls.starryBlue}
                    alt="完成イメージ：星空ブルー"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">好きな色で完成イメージ</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  好きな魔法のカラーを選ぶと、AIが完成イメージを1枚生成します。
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                  3
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
                <p className="mt-3 text-sm font-semibold">その画像から4方向をスケッチ</p>
                <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">
                  完成イメージをもとに、AIが正面・左右・背面をまとめて描き上げます。
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9cbb0] bg-white p-4 dark:border-[#232726] dark:bg-[#121415]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e] text-sm font-bold text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]">
                    4
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
              形状のプレビューは1日2回まで無料です。3Dモデルの作成は1回¥{CREDIT_PRICE_YEN}（初回は無料）で、仕上がりを確認してからご注文をご検討いただけます
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
