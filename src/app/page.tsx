import Link from "next/link";
import Image from "next/image";
import { Zen_Old_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { Gem, Moon, Smartphone } from "lucide-react";
import { FIGURE_PRICE_YEN } from "@/lib/pricing";
import { IntroSplash } from "@/components/home/IntroSplash";

const zenMincho = Zen_Old_Mincho({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-zen-mincho",
});

const zenGothic = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-gothic",
});

const display = { fontFamily: "var(--font-zen-mincho), serif" };

const COMING_SOON = [
  { name: "オーダーメイドキーホルダー（L）" },
  { name: "毛入れ用フィギュア" },
];

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
    body: "レジンとラメに包み、色と光を宿して — ひとつだけの石になる。",
  },
];

export default function Home() {
  return (
    <div
      className={`${zenGothic.variable} ${zenMincho.variable} min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]`}
      style={{ fontFamily: "var(--font-zen-gothic), sans-serif" }}
    >
      <IntroSplash />

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
            className="h-7 w-auto invert lg:h-8"
          />
          <div className="flex items-center gap-4 text-xs font-medium text-[#f3ece0]/90 lg:gap-6 lg:text-sm">
            <Link href="/guide/faq" className="hover:text-white">
              よくある質問
            </Link>
            <Link
              href="/order"
              className="rounded-full bg-[#7fd8cb] px-4 py-2 text-[#08211d] transition-colors hover:bg-[#9fe6da] lg:px-5 lg:py-2.5"
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
            <a
              href="#story"
              className="rounded-full bg-[#7fd8cb] px-8 py-3 text-sm font-bold text-[#08211d] shadow-[0_10px_30px_-12px_rgba(127,216,203,0.6)] transition-transform hover:-translate-y-0.5"
            >
              ものがたりを見る
            </a>
            <a
              href="#shop"
              className="rounded-full border border-white/40 px-8 py-3 text-sm font-bold text-[#f3ece0] transition-colors hover:border-white"
            >
              作品を見る
            </a>
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
        <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
          {/* STORY */}
          <section id="story" className="scroll-mt-6 py-16 lg:py-24">
            <span
              className="mb-3 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
              style={display}
            >
              THE STORY OF TRANSFORMATION
            </span>
            <h2
              className="max-w-md text-2xl font-semibold leading-relaxed lg:text-3xl"
              style={display}
            >
              一枚の写真が、
              <br />
              光る石になるまで。
            </h2>
            <p className="mt-4 max-w-md text-sm leading-8 text-[#6b5c40] dark:text-[#9fb0ae]">
              AIがその子の輪郭と表情をすくい上げ、3Dプリントで形にする。レジンとラメに封じ込め、最後は手作業で仕上げる
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
                  <h3 className="mb-1.5 text-sm font-bold">{s.title}</h3>
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
          暗闇でそっと光る、あなただけのお守り。
        </h2>
        <p className="relative mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
          ギャラクシーグリーンは蓄光ラメ入り。電気を消すと、青白い光がふわりと浮かび上がります。
          眠る前や、少し心細い夜に寄り添う存在に。
        </p>
        <p className="relative mx-auto mt-3 flex max-w-xs items-center justify-center gap-1.5 text-xs text-slate-400">
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          光が弱くなったら、スマホのライトを当てるだけで再チャージできます
        </p>
        </section>

        <div className="mx-auto w-full max-w-xl px-4 pb-10 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
          {/* CRAFT */}
          <section className="py-16 lg:flex lg:items-center lg:gap-14 lg:py-24">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border border-[#d9cbb0] shadow-lg dark:border-[#232726] lg:mx-0 lg:max-w-sm lg:flex-1">
              <Image
                src="/product-lineup.jpg"
                alt="LUMINA CHARO キーホルダー カラーバリエーション"
                fill
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
              <h2
                className="text-2xl font-semibold leading-relaxed lg:text-3xl"
                style={display}
              >
                ひとつずつ、
                <br />
                手のひらの上で。
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-8 text-[#6b5c40] dark:text-[#9fb0ae]">
                3Dプリントも、レジンの封入も、色とラメの調合も —
                すべて一人の手で行っています。だからこそ、量産品にはない温度を込められると思っています。
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-[#6b5c40] dark:text-[#9fb0ae]">
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  ペットの写真からAIが3Dモデルを生成
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  一点ごとに手作業で研磨・封入
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  蓄光ラメ入りカラーは暗闇でやさしく発光
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0f766e] dark:text-[#7fd8cb]">✦</span>
                  キーホルダー金具・コルク台座までセットでお届け
                </li>
              </ul>
            </div>
          </section>

          {/* SHOP / LINEUP */}
          <section id="shop" className="scroll-mt-6 pt-4 pb-12">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#8a5a34] dark:text-[#7fd8cb]">
                Lineup
              </h2>
              <span className="text-xs text-[#8a7c5e] dark:text-[#6d7c79]">
                全{COMING_SOON.length + 1}種（うち1種 販売中）
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:gap-5">
              <div className="overflow-hidden rounded-xl border border-[#d9cbb0] bg-white dark:border-[#232726] dark:bg-[#121415]">
                <div className="relative aspect-square">
                  <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[#0f766e] px-2 py-0.5 text-[9px] font-bold text-white dark:bg-[#7fd8cb]/20 dark:text-[#a9ece2] dark:ring-1 dark:ring-[#7fd8cb]/40">
                    販売中
                  </span>
                  <Image
                    src="/product-lineup.jpg"
                    alt="オーダーメイドキーホルダー（S）・カラーバリエーション"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] leading-tight">
                    キーホルダー（S）
                  </p>
                  <p className="text-xs font-bold tabular-nums">
                    ¥{FIGURE_PRICE_YEN.toLocaleString()}〜
                  </p>
                </div>
              </div>

              {COMING_SOON.map((item) => (
                <div
                  key={item.name}
                  className="overflow-hidden rounded-xl border border-dashed border-[#d9cbb0] dark:border-[#2c3230]"
                >
                  <div className="relative flex aspect-square items-center justify-center">
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-[#e8ddc6] px-2 py-0.5 text-[9px] font-bold text-[#8a7c5e] dark:bg-white/5 dark:text-[#6d7c79]">
                      近日公開
                    </span>
                    <Gem className="h-7 w-7 text-[#c9bd9f] dark:text-[#3a3f3d]" />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-[11px] leading-tight text-[#8a7c5e] dark:text-[#6d7c79]">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#a89b7d] dark:text-[#586360]">
                      近日公開
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-2 text-center">
            <Link
              href="/order"
              className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
            >
              注文する
            </Link>
          </div>
        </div>
      </main>

      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-[#e0d3b8] py-8 text-xs text-[#8a7c5e] dark:border-[#232726] dark:text-[#6d7c79]">
          <Link
            href="/guide/faq"
            className="hover:text-[#3f3424] dark:hover:text-white"
          >
            よくある質問
          </Link>
          <Link
            href="/legal/returns"
            className="hover:text-[#3f3424] dark:hover:text-white"
          >
            返品・キャンセルについて
          </Link>
          <Link
            href="/legal/tokushoho"
            className="hover:text-[#3f3424] dark:hover:text-white"
          >
            特定商取引法に基づく表記
          </Link>
          <Link
            href="/legal/privacy"
            className="hover:text-[#3f3424] dark:hover:text-white"
          >
            プライバシーポリシー
          </Link>
        </footer>
      </div>
    </div>
  );
}
