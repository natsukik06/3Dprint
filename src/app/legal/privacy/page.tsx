import { LegalBackLink } from "@/components/site/LegalBackLink";

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
        <LegalBackLink className="mb-2" />
        <div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            プライバシーポリシー
          </h1>
          <p className="text-sm text-slate-500">制定日：2026年10月4日</p>
        </div>

        <Section title="事業者情報">
          <p>
            纐纈夏輝（以下「当店」）は、Charo 3D（以下「本サービス」）における、ご利用者様（以下「お客様」）の個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>
        </Section>

        <Section title="取得する情報">
          <ul className="list-disc space-y-1 pl-5">
            <li>お名前、メールアドレス、電話番号、郵便番号、ご住所</li>
            <li>ご注文時にアップロードいただく参考写真、お持ち込みの3Dモデルデータ</li>
            <li>Googleアカウントによるログイン情報（メールアドレス、アカウントを識別するID等）</li>
            <li>生成された3Dモデル・完成イメージ画像</li>
            <li>ご注文内容（仕様・数量・金額等）およびお問い合わせ内容</li>
            <li>3Dモデルの作成回数、クレジットの残高、割引の利用状況</li>
            <li>
              友達紹介のリンクからご利用いただいた場合、紹介元のお客様を識別するための情報
            </li>
          </ul>
          <p>
            クレジットカード情報は、決済代行会社（Stripe, Inc.）の決済画面に直接入力いただく仕組みのため、当店のサーバーでは取得・保持しません。
          </p>
        </Section>

        <Section title="お客様の端末に保存する情報">
          <p>
            ご入力途中の注文内容（アップロードした写真、入力した内容、カートの中身を含みます）は、ページを移動・再読み込みしても失われないよう、お客様のブラウザ内（IndexedDB・ローカルストレージ）に保存します。この情報はお客様の端末内にのみ保存され、当店のサーバーには送信されません。ご注文の完了時、またはブラウザの設定からお客様ご自身で削除できます。
          </p>
          <p>
            ログイン状態の維持のため、ブラウザの保存領域（Firebase認証）を利用します。
          </p>
        </Section>

        <Section title="利用目的">
          <ul className="list-disc space-y-1 pl-5">
            <li>ご注文いただいた商品の製作・梱包・発送のため</li>
            <li>3Dモデルおよび完成イメージの生成のため</li>
            <li>ご注文の確認、発送のお知らせなど、取引に関する連絡のため</li>
            <li>お問い合わせ・アフターサポート対応のため</li>
            <li>決済処理のため</li>
            <li>友達紹介の特典の付与のため</li>
            <li>
              お知らせメール（セール・新商品等）の配信のため（配信にご同意いただいた方のみ。いつでも配信停止できます）
            </li>
            <li>
              完成した3Dモデルや写真を、当店の実績紹介（サイト・SNS等）に匿名で使用するため（ご同意いただいた方のみ）
            </li>
            <li>本サービスの改善・不正利用防止のため</li>
          </ul>
        </Section>

        <Section title="第三者への提供・委託">
          <p>
            当店は、本サービスの提供にあたり、以下の外部サービスを利用しています。アップロードいただいた写真や個人情報の一部は、サービス提供に必要な範囲でこれらの事業者に送信・保存されます。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Google（Firebase） - 会員認証、データ保存、ファイルストレージ</li>
            <li>Google（Gemini API） - 完成イメージ画像の生成（アップロード写真を送信します）</li>
            <li>Tripo（tripo3d.ai） - 写真からの3Dモデル生成（生成用の画像を送信します）</li>
            <li>Stripe, Inc. - 決済処理</li>
            <li>Resend, Inc. - ご注文の確認メール・お知らせメールの送信（メールアドレス、お名前、注文内容の一部）</li>
            <li>Vercel Inc. - 本サービスの運営基盤（ホスティング）</li>
            <li>
              配送事業者（日本郵便、ヤマト運輸 等） -
              商品の配送のため、お名前・ご住所・電話番号をお渡しします
            </li>
          </ul>
          <p>
            上記のうち、Google、Tripo、Stripe、Resend、Vercelは、日本国外（米国等）にサーバーや事業所を持つ事業者です。個人情報は、これらの事業者のプライバシーポリシーに従い、国外で取り扱われる場合があります。
          </p>
          <p>
            上記の場合および法令に基づく場合を除いて、お客様の同意なく第三者に個人情報を提供することはありません。
          </p>
        </Section>

        <Section title="保管期間">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              3Dモデルのデータは、商品の発送から7日後に自動的に削除します。ご注文に至らなかった場合は、生成から14日後に削除します。
            </li>
            <li>
              ご注文時にアップロードいただいた参考写真は、アップロードから1年後に自動的に削除します。
            </li>
            <li>
              ご注文の記録（お名前・ご住所・注文内容・金額等）は、商品の発送・アフターサポート、および法令（税法等）で保存が義務付けられる期間、保管します。
            </li>
            <li>
              お名前・ご住所・電話番号などのご注文者情報は、次回のご注文を簡単にするため、お客様のアカウントに保存します。アカウントの削除をご希望の場合は、下記お問い合わせ先までご連絡ください。
            </li>
            <li>
              3Dモデル作成クレジットの残高と利用の記録は、最後にクレジットをご購入・ご利用いただいた日から1年後に失効・削除します。
            </li>
            <li>
              上記以外の情報は、利用目的の達成に必要な期間保管し、不要になったときに削除します。
            </li>
          </ul>
        </Section>

        <Section title="お知らせメールの配信停止">
          <p>
            お知らせメールは、メール内の配信停止リンクから、いつでも配信を停止できます。ご注文の確認や発送のご連絡など、取引に必要なメールは、配信停止後もお送りする場合があります。
          </p>
        </Section>

        <Section title="開示・訂正・削除等のご請求">
          <p>
            お客様は、当店が保有するご自身の個人情報について、開示・訂正・利用停止・削除を請求することができます。ご希望の場合は、下記お問い合わせ先までご連絡ください。ご本人確認のうえ、合理的な期間内に対応します。
          </p>
        </Section>

        <Section title="お問い合わせ先">
          <p>纐纈夏輝</p>
          <p>メール：natsuki.ko006@gmail.com</p>
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
