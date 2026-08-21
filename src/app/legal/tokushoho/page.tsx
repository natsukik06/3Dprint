import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  ADDITIONAL_UNIT_PRICE_YEN,
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_MIN_QUANTITY,
  SHIPPING_FEE_YEN,
} from "@/lib/pricing";

type Row = { label: string; value: string };

const ROWS: Row[] = [
  { label: "販売業者", value: "【本名（屋号を使う場合は屋号も併記）を入力してください】" },
  { label: "運営統括責任者", value: "【責任者の氏名を入力してください】" },
  {
    label: "所在地",
    value:
      "【都道府県・市区町村・番地まで入力してください（請求があれば遅滞なく開示する運用にする場合はその旨に差し替え）】",
  },
  { label: "電話番号", value: "【電話番号を入力してください】" },
  { label: "メールアドレス", value: "【問い合わせ用メールアドレスを入力してください】" },
  {
    label: "販売価格",
    value: `1個目 ${FIGURE_PRICE_YEN.toLocaleString()}円（税込）、2個目以降 +${ADDITIONAL_UNIT_PRICE_YEN.toLocaleString()}円/個（税込）。表示価格はすべて税込です。`,
  },
  {
    label: "商品代金以外の必要料金",
    value: `送料 ${SHIPPING_FEE_YEN.toLocaleString()}円（税込）。同一注文で合計${FREE_SHIPPING_MIN_QUANTITY}個以上ご注文の場合は送料無料。決済手数料はかかりません。`,
  },
  { label: "お支払い方法", value: "クレジットカード決済（Stripe）" },
  { label: "お支払い時期", value: "ご注文時に全額前払いとなります。" },
  {
    label: "引き渡し時期",
    value:
      "【受注生産のため実際の発送目安（例：決済完了後◯週間以内）を入力してください】",
  },
  {
    label: "返品・交換について",
    value:
      "本商品はお客様の写真をもとに1点ずつ製作するオーダーメイド品のため、お客様都合による返品・交換はお受けしておりません。到着時に破損・不良があった場合は、商品到着後7日以内にご連絡いただければ良品との交換または返金にて対応いたします。【実際の運用に合わせて内容をご確認・修正してください】",
  },
  {
    label: "キャンセルについて",
    value:
      "3Dモデルの製作着手前であればキャンセル・返金が可能です。着手後のキャンセルはお受けできません。【実際の運用に合わせて内容をご確認・修正してください】",
  },
];

export default function TokushohoPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          トップに戻る
        </Link>
        <h1 className="mb-2 text-xl font-bold text-slate-900">
          特定商取引法に基づく表記
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          このページはテンプレートです。【 】で示した項目は実際の情報に差し替えてください。
        </p>
        <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {ROWS.map((row) => (
            <div key={row.label} className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-slate-900">{row.label}</dt>
              <dd className="text-sm leading-relaxed text-slate-600 sm:col-span-2">
                {row.value}
              </dd>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
