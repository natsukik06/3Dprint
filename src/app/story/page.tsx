"use client";

import { Moon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { displayFont as display, zenGothic, zenMincho } from "@/lib/fonts";

const STORY_STEPS = [
  {
    num: "01",
    title: "写真",
    body: "スマホの中に眠る、いつもの一枚。特別な撮影は要りません。",
  },
  {
    num: "02",
    title: "モデル",
    body: "AIが立体を起こし、輪郭・毛並み・表情のニュアンスをすくい上げます。",
  },
  {
    num: "03",
    title: "クリスタル",
    body: "レジンに包み、色と光を宿して — ひとつだけの石になる。",
  },
];

export default function StoryPage() {
  return (
    <div
      className={`${zenGothic.variable} ${zenMincho.variable} min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]`}
      style={{ fontFamily: "var(--font-zen-gothic), sans-serif" }}
    >
      <SiteHeader />

      <main>
        <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
          {/* STORY */}
          <section className="py-16 lg:py-24">
            <span
              className="mb-3 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
              style={display}
            >
              THE STORY OF TRANSFORMATION
            </span>
            <h1
              className="max-w-md text-2xl font-semibold leading-relaxed lg:text-3xl"
              style={display}
            >
              一枚の写真が、
              <br />
              ひとつだけの石になるまで。
            </h1>
            <p className="mt-4 max-w-md text-sm leading-8 text-[#6b5c40] dark:text-[#9fb0ae]">
              AIがその子の輪郭と表情をすくい上げ、3Dプリントで形にする。レジンに封じ込め、最後は手作業で仕上げる
              —
              すべて、あなたの手のひらに収まるひとつの石になるために。
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {STORY_STEPS.map((s) => (
                <div
                  key={s.num}
                  className="rounded-2xl border border-[#d9cbb0] bg-white/70 p-6 dark:border-[#232726] dark:bg-[#121415]"
                >
                  <span
                    className="mb-3 block text-3xl italic text-[#0f766e] dark:text-[#7fd8cb]"
                    style={display}
                  >
                    {s.num}
                  </span>
                  <h2 className="mb-1.5 text-sm font-bold">{s.title}</h2>
                  <p className="text-xs leading-relaxed text-[#6b5c40] dark:text-[#9fb0ae]">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* GLOW */}
        <section className="relative overflow-hidden bg-[#0c0e0d] px-6 py-16 text-center text-white lg:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/30 blur-3xl"
          />
          <div
            aria-hidden
            className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(127,216,203,0.9), rgba(127,216,203,0.2) 45%, transparent 70%)",
            }}
          >
            <Moon className="h-8 w-8 text-emerald-200" />
          </div>
          <span
            className="relative mt-6 block text-xs italic tracking-[0.2em] text-[#7fd8cb]"
            style={display}
          >
            A QUIET LIGHT
          </span>
          <h2
            className="relative mx-auto mt-3 max-w-md text-xl font-semibold leading-relaxed lg:text-2xl"
            style={display}
          >
            光を通して透ける、あなただけのお守り。
          </h2>
          <p className="relative mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
            透きとおったクリアカラーのレジンで仕上げます。光にかざすと色が透け、見る角度や光の入り方で、表情がやわらかく変わります。
            いつもそばに持ち歩ける存在に。
          </p>
        </section>

        <div className="mx-auto w-full max-w-xl px-4 pb-10 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
          {/* CRAFT */}
          <section className="py-16 lg:flex lg:items-center lg:gap-14 lg:py-24">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border border-[#d9cbb0] shadow-lg dark:border-[#232726] lg:mx-0 lg:max-w-sm lg:flex-1">
              <Image
                src="/product-lineup.jpg"
                alt="Charo 3D キーホルダー カラーバリエーション"
                fill
                sizes="(min-width: 1024px) 384px, 320px"
                className="object-cover"
              />
            </div>
            <div className="mt-8 lg:mt-0 lg:flex-1">
              <span
                className="mb-3 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
                style={display}
              >
                MADE BY ONE PAIR OF HANDS
              </span>
              <h2 className="text-2xl font-semibold leading-relaxed lg:text-3xl" style={display}>
                ひとつずつ、
                <br />
                手のひらの上で。
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-8 text-[#6b5c40] dark:text-[#9fb0ae]">
                3Dプリントも、レジンの封入も、色の調合も —
                すべて一人の手で行っています。だからこそ、量産品にはない温度を込められると思っています。
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-[#6b5c40] dark:text-[#9fb0ae]">
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  ペットや思い出の品の写真からAIが3Dモデルを生成
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  一点ごとに手作業で研磨・封入
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  光を通して色が透ける、クリアカラーのレジン仕上げ
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  ご希望の方には、キーホルダー用の金具穴（+¥50）もお付けできます
                </li>
              </ul>
            </div>
          </section>

          <div className="pb-6 text-center">
            <Link
              href="/products"
              className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
            >
              料金・ラインナップを見る
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
