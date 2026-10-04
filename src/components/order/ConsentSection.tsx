"use client";

import Link from "next/link";
import { useFormContext } from "react-hook-form";
import { FREE_SHIPPING_SUBTOTAL_YEN, SHIPPING_FEE_YEN } from "@/lib/pricing";
import type { OrderFormValues } from "@/types/order";

export function ConsentSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
        <p className="mb-1 font-semibold text-slate-900">ご注文前の最終確認</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>お支払い：クレジットカード・PayPay。ご注文時に全額前払いです（表示価格はすべて税込）。</li>
          <li>
            送料：{SHIPPING_FEE_YEN.toLocaleString()}円（商品代金の合計が
            {FREE_SHIPPING_SUBTOTAL_YEN.toLocaleString()}円以上で無料）。
          </li>
          <li>発送：決済完了後、1週間〜1か月ほどかかります（一人で手作りしています）。</li>
          <li>
            返品・キャンセル：オーダーメイド品のため、お客様都合の返品・交換はできません。製作に着手する前であればキャンセルできます。破損・不良は到着後7日以内にご連絡ください。
          </li>
        </ul>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          {...register("agreeCopyright")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          アップロードした画像・作りたいものが、第三者の著作権・商標権・意匠権（アニメ等のキャラクター、ブランドロゴ、商品デザイン等）を侵害していないことに同意します。侵害のおそれがあると当店が判断した場合、注文をお断りする場合があります
        </span>
      </label>
      {errors.agreeCopyright && (
        <p className="text-sm text-red-600">
          {errors.agreeCopyright.message}
        </p>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          {...register("agreeRisk")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          細すぎるパーツや厚み不足による造形失敗のリスク（仕様上の限界）について了承します
        </span>
      </label>
      {errors.agreeRisk && (
        <p className="text-sm text-red-600">{errors.agreeRisk.message}</p>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          {...register("agreeAiAccuracy")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          AIが生成する3Dモデルは、実際の写真やイメージと完全に一致しない場合があります。生成後のプレビュー画面でご確認・作り直しいただけますので、表示された形状にご納得のうえでご注文ください。生成結果の見た目（似ているかどうか）を理由とした返品・返金はお受けできません
        </span>
      </label>
      {errors.agreeAiAccuracy && (
        <p className="text-sm text-red-600">{errors.agreeAiAccuracy.message}</p>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
        <input
          type="checkbox"
          {...register("agreeShowcase")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          完成した3Dモデルや写真を、当店の実績紹介（サイト・SNS等）に匿名で使用することに同意します（任意・チェックしなくても注文できます）
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
        <input
          type="checkbox"
          {...register("agreeMarketingEmail")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          セール・値下げなどのお知らせメールを受け取ることに同意します（任意・いつでも配信停止できます）
        </span>
      </label>

      <p className="text-xs text-slate-500">
        ご注文にあたっては
        <Link href="/legal/tokushoho?from=order" className="underline hover:text-slate-700" target="_blank">
          特定商取引法に基づく表記
        </Link>
        、
        <Link href="/legal/returns?from=order" className="underline hover:text-slate-700" target="_blank">
          返品・キャンセルについて
        </Link>
        および
        <Link href="/legal/privacy?from=order" className="underline hover:text-slate-700" target="_blank">
          プライバシーポリシー
        </Link>
        をご確認ください。
      </p>
    </div>
  );
}
