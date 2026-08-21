import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          トップに戻る
        </Link>
        <div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            プライバシーポリシー
          </h1>
          <p className="text-sm text-slate-500">
            このページはテンプレートです。【 】で示した項目は実際の情報に差し替え、内容全体を実際の運用に合わせてご確認ください。
          </p>
        </div>

        <Section title="事業者情報">
          <p>
            【本名（屋号を使う場合は屋号も併記）】（以下「当店」）は、本サービス（以下「本サービス」）における、ご利用者様（以下「お客様」）の個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>
        </Section>

        <Section title="取得する情報">
          <ul className="list-disc space-y-1 pl-5">
            <li>お名前、メールアドレス、電話番号、郵便番号、ご住所</li>
            <li>ご注文時にアップロードいただく参考写真</li>
            <li>Googleアカウントによるログイン情報（メールアドレス等）</li>
            <li>生成された3Dモデル・完成イメージ画像</li>
            <li>ご注文内容（仕様・数量・金額等）およびお問い合わせ内容</li>
          </ul>
          <p>
            クレジットカード情報につきましては、決済代行会社（Stripe, Inc.）の決済画面に直接入力いただく仕組みのため、当店のサーバーでは取得・保持しません。
          </p>
        </Section>

        <Section title="利用目的">
          <ul className="list-disc space-y-1 pl-5">
            <li>ご注文いただいた商品の製作・発送のため</li>
            <li>3Dモデルおよび完成イメージの生成のため</li>
            <li>お問い合わせ・アフターサポート対応のため</li>
            <li>決済処理のため</li>
            <li>本サービスの改善・不正利用防止のため</li>
          </ul>
        </Section>

        <Section title="第三者への提供・委託">
          <p>
            当店は、本サービスの提供にあたり、以下の外部サービスを利用しています。アップロードいただいた写真や個人情報の一部は、サービス提供に必要な範囲でこれらの事業者に送信・保存されます。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Google（Firebase） - 会員認証、データ保存、ファイルストレージ</li>
            <li>Tripo（tripo3d.ai） - アップロード写真からの3Dモデル生成</li>
            <li>Google（Gemini API） - 完成イメージ画像の生成</li>
            <li>Stripe, Inc. - 決済処理</li>
          </ul>
          <p>
            上記の場合を除き、法令に基づく場合等を除いて、お客様の同意なく第三者に個人情報を提供することはありません。
          </p>
        </Section>

        <Section title="保管期間">
          <p>
            お客様の個人情報は、上記利用目的の達成に必要な期間、または法令で保存が義務付けられる期間、当店にて保管します。【実際の保管方針を入力してください】
          </p>
        </Section>

        <Section title="開示・訂正・削除等のご請求">
          <p>
            お客様は、当店が保有するご自身の個人情報について、開示・訂正・利用停止・削除を請求することができます。ご希望の場合は、下記お問い合わせ先までご連絡ください。
          </p>
        </Section>

        <Section title="お問い合わせ先">
          <p>【問い合わせ用メールアドレスを入力してください】</p>
        </Section>

        <Section title="改定について">
          <p>
            本ポリシーの内容は、法令の変更やサービス内容の変更等に応じて、予告なく変更することがあります。変更後の内容は本ページに掲載した時点で効力を生じるものとします。
          </p>
        </Section>
      </main>
    </div>
  );
}
