import Link from "next/link";
import Image from "next/image";
import { Gem, Moon, Smartphone } from "lucide-react";
import { FIGURE_PRICE_YEN } from "@/lib/pricing";

const COMING_SOON = [
  { name: "オーダーメイドキーホルダー（L）" },
  { name: "毛入れ用フィギュア" },
];

export default function Home() {
  return (
    <div className="min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
        <nav className="flex items-center justify-between py-5 lg:py-7">
          <Image
            src="/logo-full.png"
            alt="LUMINA CHARO"
            width={1569}
            height={1034}
            priority
            className="h-7 w-auto dark:invert lg:h-8"
          />
          <div className="flex items-center gap-4 text-xs font-medium text-[#6b5c40] dark:text-[#9fb0ae] lg:gap-6 lg:text-sm">
            <Link
              href="/guide/faq"
              className="hover:text-[#3f3424] dark:hover:text-white"
            >
              よくある質問
            </Link>
            <Link
              href="/order"
              className="rounded-full bg-[#0f766e] px-4 py-2 text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da] lg:px-5 lg:py-2.5"
            >
              注文する
            </Link>
          </div>
        </nav>

        <main className="pb-10">
          <header className="mb-12 pt-4 text-center lg:flex lg:items-center lg:gap-12 lg:pt-10 lg:text-left">
            <div className="relative mx-auto mb-6 aspect-square w-44 shrink-0 overflow-hidden rounded-2xl shadow-lg sm:w-52 lg:mb-0 lg:w-72">
              <video
                src="/hero-video.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
            <div className="lg:flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                暗闇でそっと光る、
                <br />
                あなただけのお守り。
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[#6b5c40] dark:text-[#a9b3b1] lg:mx-0 lg:max-w-sm lg:text-base">
                愛犬・愛猫の写真から、世界に一つのクリスタルキーホルダーをお作りします。
              </p>
              <Link
                href="/order"
                className="mt-6 inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
              >
                注文する
              </Link>
            </div>
          </header>

          <section className="mb-12">
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

          <section className="mx-auto mb-12 max-w-xl rounded-2xl border border-[#e0d3b8] bg-white/60 px-6 py-7 text-center dark:border-[#1d211f] dark:bg-transparent">
            <span className="text-base text-[#0f766e] dark:text-[#6fc9bd]">
              ✦
            </span>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#6b5c40] dark:text-[#9fb0ae]">
              3Dプリントとレジン封入、すべて一つひとつ手作業で仕上げています。
              <br />
              あなたの大切な子の面影を、そのまま形に。
            </p>
          </section>

          <section className="relative mx-auto max-w-xl overflow-hidden rounded-2xl bg-slate-900 px-6 py-8 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/40 blur-3xl"
            />
            <Moon className="relative mx-auto h-7 w-7 text-emerald-300" />
            <h2 className="relative mt-3 text-lg font-bold text-white">
              暗闇でそっと光る、あなただけのお守り
            </h2>
            <p className="relative mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
              ギャラクシーグリーンは蓄光ラメ入り。電気を消すと、青白い光がふわりと浮かび上がります。
              眠る前や、少し心細い夜に寄り添う存在に。
            </p>
            <p className="relative mx-auto mt-3 flex max-w-xs items-center justify-center gap-1.5 text-xs text-slate-400">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              光が弱くなったら、スマホのライトを当てるだけで再チャージできます
            </p>
          </section>

          <div className="mt-10 text-center">
            <Link
              href="/order"
              className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
            >
              注文する
            </Link>
          </div>
        </main>

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
