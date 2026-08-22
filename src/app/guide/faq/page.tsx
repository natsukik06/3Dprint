import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_BOTTOM_HOLE_DIAMETER_MM } from "@/types/order";

type QA = { q: string; a: string };

const QAS: QA[] = [
  {
    q: "納期はどれくらいですか？",
    a: "【実際の製作・発送目安（例：ご入金確認後◯週間以内に発送）を入力してください】ご注文状況により前後する場合があります。",
  },
  {
    q: "どんな写真を用意すればいいですか？",
    a: "全体像がわかる写真1枚と、特徴がわかるアップ写真1枚の組み合わせがおすすめです。詳しい良い例・避けたい例は写真の撮り方ガイドをご覧ください。",
  },
  {
    q: "3Dプリントならではの仕上がりの特徴はありますか？",
    a: "積層造形（3Dプリント）特有のわずかな積層痕や、レジン内の微細な気泡が入る場合があります。当店ではレジンでコーティングすることで積層痕をなめらかにし、強度も補強していますが、完全に均一な仕上がりをお約束するものではなく、手作業による一点物ならではの風合いとしてご理解いただけますと幸いです。",
  },
  {
    q: "毛入れ用（空洞・コルク栓付き）はどうやって使いますか？",
    a: `底面に直径${DEFAULT_BOTTOM_HOLE_DIAMETER_MM}mmの穴が空いた状態でお届けします。付属（またはご家庭にある）ピンセットなどで、ブラッシングなどで集めた愛犬・愛猫の毛を少しずつ穴から詰めていただき、最後にコルク栓で蓋をしてください。毛量の目安や詰め方のコツは商品ページの案内もあわせてご確認ください。`,
  },
  {
    q: "暗闇で光る「ギャラクシーグリーン」はどのくらい光りますか？",
    a: "蓄光ラメを配合しているため、日中の光やスマートフォンのライトを数十秒当てることで蓄光し、暗い場所で優しく発光します。光は時間とともに徐々に弱くなりますが、再度光を当てることで繰り返しチャージできます。",
  },
  {
    q: "服やアクセサリーも忠実に再現してもらえますか？",
    a: "既存キャラクターの衣装や、権利者のいるブランドロゴ等が写り込んだ服・柄については、著作権上の理由で忠実な再現ができない場合があります。無地の服やシンプルなアクセサリーは再現できる場合がありますので、ご要望欄にてお知らせください。",
  },
  {
    q: "支払い方法を教えてください",
    a: "クレジットカード決済（Stripe）に対応しています。ご注文時に全額前払いとなります。",
  },
  {
    q: "複数のペット・サイズ・カラーをまとめて注文できますか？",
    a: "はい。注文フォームでは異なるモチーフ・サイズ・カラーを1つのセットとしてまとめて注文でき、合計個数に応じた割引・送料無料が自動で適用されます。",
  },
  {
    q: "キャンセル・返品はできますか？",
    a: "オーダーメイド品のため、製作着手後のお客様都合によるキャンセル・返品はお受けできません。詳しくは返品・キャンセル・不良品対応についてのページをご確認ください。",
  },
];

export default function FaqPage() {
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
        <h1 className="mb-6 text-xl font-bold text-slate-900">よくある質問</h1>

        <div className="space-y-3">
          {QAS.map((qa) => (
            <div
              key={qa.q}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm font-semibold text-slate-900">Q. {qa.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                A. {qa.a}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          その他ご不明な点は
          <Link
            href="/legal/tokushoho"
            className="underline underline-offset-2 hover:text-slate-600"
          >
            特定商取引法に基づく表記
          </Link>
          記載の連絡先までお気軽にお問い合わせください。
        </p>
      </main>
    </div>
  );
}
