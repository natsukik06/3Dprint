import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, X } from "lucide-react";

type Example = { id: string; title: string; description: string };

const GOOD_EXAMPLES: Example[] = [
  {
    id: "good-bright",
    title: "明るい場所で撮影",
    description: "自然光やしっかりした照明の下で撮ると、色や毛並みが正確に伝わります",
  },
  {
    id: "good-fullbody",
    title: "全身がフレームに収まっている",
    description: "頭からしっぽ・脚の先まで、体全体が写っていること",
  },
  {
    id: "good-focus",
    title: "ピントが合っている",
    description: "ぶれ・ピンボケのない、はっきりした写真",
  },
  {
    id: "good-background",
    title: "シンプルな背景",
    description: "背景がごちゃごちゃしていないと、AIが形を認識しやすくなります",
  },
  {
    id: "good-angle",
    title: "複数の角度がある",
    description: "正面・横・後ろなど、角度違いの写真があると精度が上がります",
  },
];

const BAD_EXAMPLES: Example[] = [
  {
    id: "bad-dark",
    title: "暗い・逆光",
    description: "影になって色や輪郭がわからない写真は避けてください",
  },
  {
    id: "bad-cropped",
    title: "体の一部しか写っていない",
    description: "顔だけ・後ろ姿だけなど、全身が確認できない写真",
  },
  {
    id: "bad-blurry",
    title: "ピンボケ・ブレている",
    description: "動いている最中に撮った、ぼやけた写真",
  },
  {
    id: "bad-occluded",
    title: "他のものと重なっている",
    description: "人の手やおもちゃなどで体が隠れている写真",
  },
  {
    id: "bad-angle",
    title: "極端に見下ろす・見上げる角度",
    description: "真上や真下からなど、形が歪んで見える角度",
  },
];

function ExampleCard({
  example,
  good,
}: {
  example: Example;
  good: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        good ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white bg-slate-200">
        <Image
          src={`/guide/${example.id}.jpg`}
          alt={example.title}
          fill
          className="object-cover"
          sizes="64px"
        />
        <span
          className={`absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${
            good ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {good ? (
            <Check className="h-2.5 w-2.5 text-white" />
          ) : (
            <X className="h-2.5 w-2.5 text-white" />
          )}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{example.title}</p>
        <p className="mt-0.5 text-xs text-slate-600">{example.description}</p>
      </div>
    </div>
  );
}

export default function PhotoTipsPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <Link
          href="/order"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          注文ページに戻る
        </Link>
        <h1 className="mb-2 text-xl font-bold text-slate-900">
          きれいに仕上げるための写真の撮り方
        </h1>
        <p className="mb-1 text-sm leading-relaxed text-slate-600">
          写真の質は、AIが立体化する精度に直接影響します。以下を参考に撮影してください。
        </p>
        <p className="mb-6 text-xs text-slate-400">
          ※例の写真はイメージを伝えるためのAI生成画像です（実際のお客様の写真ではありません）
        </p>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            おすすめの写真の組み合わせ（最大5枚）
          </h2>
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                1
              </span>
              <span>
                <b>全体像がわかる写真</b>
                （正面から、頭からしっぽまで全身が写っているもの）
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                2
              </span>
              <span>
                <b>特徴がわかる写真</b>
                （顔のアップ、模様や毛色の特徴が伝わるもの）
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[11px] font-bold text-slate-700">
                +
              </span>
              <span>
                （任意）横向き・後ろ姿など、追加の角度があるとさらに精度が上がります
              </span>
            </li>
          </ol>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-emerald-700">
            良い写真の例
          </h2>
          <div className="space-y-2">
            {GOOD_EXAMPLES.map((example) => (
              <ExampleCard key={example.id} example={example} good />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-red-700">
            避けてほしい写真の例
          </h2>
          <div className="space-y-2">
            {BAD_EXAMPLES.map((example) => (
              <ExampleCard key={example.id} example={example} good={false} />
            ))}
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link
            href="/order"
            className="inline-block rounded-xl bg-slate-800 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            注文ページで写真をアップロードする
          </Link>
        </div>
      </main>
    </div>
  );
}
