import Link from "next/link";
import { Sparkles } from "lucide-react";

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

        <div className="mt-10 text-center">
          <Link
            href="/order"
            className="inline-block rounded-xl bg-slate-800 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            注文する
          </Link>
        </div>

        <footer className="mt-12 flex justify-center gap-4 text-xs text-slate-400">
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
