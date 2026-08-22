"use client";

import Link from "next/link";
import { useFormContext } from "react-hook-form";
import type { OrderFormValues } from "@/types/order";

export function ConsentSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          {...register("agreeCopyright")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
        />
        <span className="text-sm text-slate-700">
          アップロードした画像が第三者の著作権（アニメキャラ等）を侵害していないことに同意します
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
        <Link href="/legal/tokushoho" className="underline hover:text-slate-700" target="_blank">
          特定商取引法に基づく表記
        </Link>
        、
        <Link href="/legal/returns" className="underline hover:text-slate-700" target="_blank">
          返品・キャンセルについて
        </Link>
        および
        <Link href="/legal/privacy" className="underline hover:text-slate-700" target="_blank">
          プライバシーポリシー
        </Link>
        をご確認ください。
      </p>
    </div>
  );
}
