"use client";

import { Minus, Plus } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { PetDetailsFields } from "@/components/order/PetDetailsFields";
import { RadioCard } from "@/components/ui/RadioCard";
import {
  ADDITIONAL_UNIT_PRICE_YEN,
  FIGURE_PRICE_YEN,
  MAGIC_COLOR_LABELS,
  POSE_LABELS,
  getTotalQuantity,
} from "@/lib/pricing";
import {
  AVAILABLE_SIZE_OPTIONS,
  MAGIC_COLOR_OPTIONS,
  MAX_TOTAL_QUANTITY,
  POSE_OPTIONS,
  SIZE_LABELS,
  type OrderFormValues,
} from "@/types/order";

export function SpecOptions() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  const colorQuantities = useWatch({ control, name: "colorQuantities" });
  const totalQuantity = getTotalQuantity(colorQuantities);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-slate-700"
        >
          何を作りますか？
        </label>
        <input
          id="subject"
          type="text"
          placeholder="例：たれ耳のうさぎ"
          {...register("subject")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.subject && (
          <p className="text-sm text-red-600">{errors.subject.message}</p>
        )}
      </div>

      <PetDetailsFields />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">ポーズ</legend>
        <Controller
          name="pose"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {POSE_OPTIONS.map((option) => (
                  <RadioCard
                    key={option}
                    name={field.name}
                    value={option}
                    checked={field.value === option}
                    onChange={field.onChange}
                    label={POSE_LABELS[option]}
                  />
                ))}
              </div>
              {fieldState.error && (
                <p className="text-sm text-red-600">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">サイズ</legend>
        <Controller
          name="sizeOption"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_SIZE_OPTIONS.map((option) => (
                  <RadioCard
                    key={option}
                    name={field.name}
                    value={option}
                    checked={field.value === option}
                    onChange={field.onChange}
                    label={SIZE_LABELS[option]}
                  />
                ))}
              </div>
              {fieldState.error && (
                <p className="text-sm text-red-600">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          魔法のカラー・個数
        </legend>
        <p className="text-xs text-slate-500">
          同じ形状を複数のカラーで注文できます（1個目¥
          {FIGURE_PRICE_YEN.toLocaleString()}、2個目以降は+
          {ADDITIONAL_UNIT_PRICE_YEN}円、最大{MAX_TOTAL_QUANTITY}個。
          <span className="font-semibold text-slate-700">
            3個以上で送料無料
          </span>
          ）
        </p>
        <Controller
          name="colorQuantities"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="grid gap-2">
                {MAGIC_COLOR_OPTIONS.map((color) => {
                  const value = field.value[color];
                  return (
                    <div
                      key={color}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <span className="text-sm font-medium text-slate-900">
                        {MAGIC_COLOR_LABELS[color]}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange({
                              ...field.value,
                              [color]: Math.max(0, value - 1),
                            })
                          }
                          disabled={value <= 0}
                          aria-label={`${MAGIC_COLOR_LABELS[color]}を減らす`}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm tabular-nums text-slate-900">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange({
                              ...field.value,
                              [color]: Math.min(
                                MAX_TOTAL_QUANTITY,
                                value + 1
                              ),
                            })
                          }
                          disabled={totalQuantity >= MAX_TOTAL_QUANTITY}
                          aria-label={`${MAGIC_COLOR_LABELS[color]}を増やす`}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                合計 {totalQuantity} 個
              </p>
              {fieldState.error && (
                <p className="text-sm text-red-600">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          金具穴（任意）
        </legend>
        <Controller
          name="wantsHardware"
          control={control}
          render={({ field }) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-slate-300">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-slate-800"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-900">
                  ストラップ・キーホルダー用の金具穴を追加する
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  3Dプレビュー生成後、モデル上をクリックして位置を指定できます
                </span>
              </span>
            </label>
          )}
        />
      </fieldset>
    </div>
  );
}
