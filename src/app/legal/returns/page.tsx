import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ReturnsPage() {
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
        <h1 className="mb-6 text-xl font-bold text-slate-900">
          返品・キャンセル・不良品対応について
        </h1>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              オーダーメイド品について
            </h2>
            <p>
              本商品は、お客様からお預かりした大切なペットの写真をもとに、AIによる3Dモデル化から手作業でのレジン封入まで、一つひとつ個別に製作する世界に一つだけのオーダーメイド品です。そのため、他のお客様への転用ができず、製作着手後のキャンセル・お客様都合による返品は原則としてお受けできません。あらかじめご了承のうえご注文ください。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              製作着手前のキャンセル
            </h2>
            <p>
              3Dモデルの製作に着手する前であれば、キャンセル・返金が可能です。ご注文後、お早めにお問い合わせください。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              不良品・配送中の破損について
            </h2>
            <p>
              配送中の破損や、レジンの硬化不良など当店に起因する不良品が届いた場合は、商品到着後7日以内にご連絡ください。送料当店負担にて、速やかに新しい製品とのお取り替え、または全額返金にて対応いたします。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              仕上がりについてのお願い
            </h2>
            <p>
              3Dプリント造形とレジン封入という工程の特性上、わずかな積層痕や気泡、色味の個体差が生じる場合があります。これらは手作業による一点物ならではの風合いとしてご理解いただけますと幸いです（詳しくは
              <Link
                href="/guide/faq"
                className="underline underline-offset-2 hover:text-slate-900"
              >
                よくある質問
              </Link>
              もご確認ください）。
            </p>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              お問い合わせ
            </h2>
            <p>
              返品・交換に関するお問い合わせは、
              <Link
                href="/legal/tokushoho"
                className="underline underline-offset-2 hover:text-slate-900"
              >
                特定商取引法に基づく表記
              </Link>
              に記載の連絡先までご連絡ください。
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
