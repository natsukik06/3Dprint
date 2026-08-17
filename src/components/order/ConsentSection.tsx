"use client";

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
    </div>
  );
}
