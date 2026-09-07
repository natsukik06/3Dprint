import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  ADDITIONAL_UNIT_PRICE_YEN,
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  SHIPPING_FEE_YEN,
  SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN,
  SMALL_SIZE_PRICE_YEN,
} from "@/lib/pricing";

type Row = { label: string; value: string };

const ROWS: Row[] = [
  { label: "販売業者", value: "纐纈夏輝" },
  { label: "運営統括責任者", value: "纐纈夏輝" },
  {
    label: "所在地",
    value: "ご請求をいただいた場合、遅滞なく開示いたします。",
  },
  {
    label: "電話番号",
    value: "ご請求をいただいた場合、遅滞なく開示いたします。",
  },
  { label: "メールアドレス", value: "natsuki.ko006@gmail.com" },
  {
    label: "販売価格",
    value: `Sサイズ 1個目${SMALL_SIZE_PRICE_YEN.toLocaleString()}円、2個目以降+${SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN.toLocaleString()}円/個（税込）。Mサイズ 1個目${FIGURE_PRICE_YEN.toLocaleString()}円、2個目以降+${ADDITIONAL_UNIT_PRICE_YEN.toLocaleString()}円/個（税込）。表示価格はすべて税込です。`,
  },
  {
    label: "商品代金以外の必要料金",
    value: `送料 ${SHIPPING_FEE_YEN.toLocaleString()}円（税込）。同一注文で合計${FREE_SHIPPING_SUBTOTAL_YEN.toLocaleString()}円以上ご注文の場合は送料無料。ストラップ・キーホルダー用金具穴の追加は+${HARDWARE_ADDON_PRICE_YEN.toLocaleString()}円/個（税込・任意）。決済手数料はかかりません。`,
  },
  { label: "お支払い方法", value: "クレジットカード決済・PayPay（Stripe）" },
  { label: "お支払い時期", value: "ご注文時に全額前払いとなります。" },
  {
    label: "引き渡し時期",
    value:
      "決済完了後、発送まで通常3週間ほどお時間をいただいております。特にサービス開始直後はご注文が集中し、発送までお時間をいただく場合がございます。",
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
  {
    label: "販売数量の制限",
    value:
      "一人で製作しているため、月間のご注文受付件数に上限（200件）を設けております。上限に達した場合、当月の注文受付を締め切り、翌月まで新規注文をお待ちいただきます。",
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
