import Link from "next/link";
import { Moon, Smartphone, Sparkles } from "lucide-react";

const EXAMPLES: {
  imageUrl: string | null;
  caption: string;
  colorClass: string;
}[] = [
  {
    imageUrl: null,
    caption: "星空ブルー",
    colorClass: "from-blue-400 to-indigo-600",
  },
  {
    imageUrl: null,
    caption: "ギャラクシーグリーン",
    colorClass: "from-emerald-400 to-teal-600",
  },
  {
    imageUrl: null,
    caption: "クリアオーロラ",
    colorClass: "from-sky-300 to-fuchsia-400",
  },
];

export default function Home() {
  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            魔法のクリスタルフィギュア
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            ペットや大切なものの写真から、魔法のカラーで輝くクリスタルフィギュアを作成・注文できます。
          </p>
          <Link
            href="/order"
            className="mt-6 inline-block rounded-xl bg-slate-800 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            注文する
          </Link>
        </header>

        <section>
          <h2 className="mb-3 text-center text-base font-semibold text-slate-900">
            作成例
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {EXAMPLES.map((example) => (
              <div
                key={example.caption}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br ${example.colorClass}`}
                >
                  {example.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={example.imageUrl}
                      alt={example.caption}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <Sparkles className="h-8 w-8 text-white/80" />
                  )}
                </div>
                <span className="text-xs text-slate-600">
                  {example.caption}
                  {!example.imageUrl && "（準備中）"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mt-10 overflow-hidden rounded-2xl bg-slate-900 px-6 py-8 text-center">
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
            className="inline-block rounded-xl bg-slate-800 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            注文する
          </Link>
        </div>

        <footer className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <Link href="/guide/faq" className="hover:text-slate-600">
            よくある質問
          </Link>
          <Link href="/legal/returns" className="hover:text-slate-600">
            返品・キャンセルについて
          </Link>
          <Link href="/legal/tokushoho" className="hover:text-slate-600">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/privacy" className="hover:text-slate-600">
            プライバシーポリシー
          </Link>
        </footer>
      </main>
    </div>
  );
}
