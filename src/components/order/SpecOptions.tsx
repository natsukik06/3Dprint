"use client";

import { Gem, Minus, Moon, Plus } from "lucide-react";
import Image from "next/image";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { PetDetailsFields } from "@/components/order/PetDetailsFields";
import { InfoModalButton } from "@/components/ui/InfoModalButton";
import { RadioCard } from "@/components/ui/RadioCard";
import {
  ADDITIONAL_UNIT_PRICE_YEN,
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  MAGIC_COLOR_LABELS,
  POSE_LABELS,
  SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN,
  SMALL_SIZE_PRICE_YEN,
  SUBJECT_TYPE_LABELS,
  getTotalQuantity,
} from "@/lib/pricing";
import {
  AVAILABLE_SIZE_OPTIONS,
  DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
  HARDWARE_COLOR_LABELS,
  HARDWARE_COLOR_OPTIONS,
  INITIAL_OPTIONS,
  MAGIC_COLOR_OPTIONS,
  MAX_TOTAL_QUANTITY,
  POSE_OPTIONS,
  SIZE_LABELS,
  SUBJECT_TYPE_OPTIONS,
  type HardwareColor,
  type MagicColor,
  type OrderFormValues,
} from "@/types/order";

const COLOR_IMAGE_SRC: Record<MagicColor, string | null> = {
  starryBlue: "/colors/starryBlue.jpg",
  nebulaPink: "/colors/nebulaPink.jpg",
  clearAurora: "/colors/clearAurora.jpg",
  galaxyGreen: "/colors/galaxyGreen.jpg",
  cometOrange: "/colors/cometOrange.jpg",
  cosmicPurple: "/colors/cosmicPurple.jpg",
  furCavity: null,
};

const HARDWARE_COLOR_IMAGE_SRC: Record<HardwareColor, string> = {
  silver: "/hardware/silver.jpg",
  gold: "/hardware/gold.jpg",
  roseGold: "/hardware/roseGold.jpg",
  clear: "/hardware/clear.jpg",
};

const SUBJECT_TYPE_PLACEHOLDER: Record<(typeof SUBJECT_TYPE_OPTIONS)[number], string> = {
  pet: "例：たれ耳のうさぎ",
  object: "例：旅行のお土産のマグカップ",
};

export function SpecOptions() {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  const colorQuantities = useWatch({ control, name: "colorQuantities" });
  const sizeOption = useWatch({ control, name: "sizeOption" });
  const wantsHardware = useWatch({ control, name: "wantsHardware" });
  const subjectType = useWatch({ control, name: "subjectType" }) ?? "pet";
  const totalQuantity = getTotalQuantity(colorQuantities);
  const isSmallSize = sizeOption === "S";

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">作りたいものの種類</legend>
        <Controller
          name="subjectType"
          control={control}
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUBJECT_TYPE_OPTIONS.map((option) => (
                <RadioCard
                  key={option}
                  name={field.name}
                  value={option}
                  checked={field.value === option}
                  onChange={(value) => {
                    field.onChange(value);
                    // "object" always reproduces the pose as photographed -- a mug doesn't sit,
                    // stand, or lie down, so the pose picker below is hidden for this type and
                    // the underlying field is just fixed here instead.
                    if (value === "object") setValue("pose", "asPhoto");
                  }}
                  label={SUBJECT_TYPE_LABELS[option]}
                />
              ))}
            </div>
          )}
        />
      </fieldset>

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
          placeholder={SUBJECT_TYPE_PLACEHOLDER[subjectType]}
          {...register("subject")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.subject && (
          <p className="text-sm text-red-600">{errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="initial"
          className="block text-sm font-medium text-slate-700"
        >
          刻印するイニシャルを1文字選んでください
        </label>
        <select
          id="initial"
          {...register("initial")}
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        >
          {INITIAL_OPTIONS.map((letter) => (
            <option key={letter} value={letter}>
              {letter}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          底面の目立たない場所に小さく彫り込みます。複数点セットで作る場合も、選んだ文字でお手元の一点一点を見分けられます。
        </p>
        {errors.initial && (
          <p className="text-sm text-red-600">{errors.initial.message}</p>
        )}
      </div>

      <PetDetailsFields />

      {subjectType !== "object" && (
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
      )}

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
          同じ形状を複数のカラーで注文できます（
          {isSmallSize ? (
            <>
              1個目¥{SMALL_SIZE_PRICE_YEN.toLocaleString()}、2個目以降は+
              {SMALL_SIZE_ADDITIONAL_UNIT_PRICE_YEN}円
            </>
          ) : (
            <>
              1個目¥{FIGURE_PRICE_YEN.toLocaleString()}、2個目以降は+
              {ADDITIONAL_UNIT_PRICE_YEN}円
            </>
          )}
          、最大{MAX_TOTAL_QUANTITY}個。
          <span className="font-semibold text-slate-700">
            合計{FREE_SHIPPING_SUBTOTAL_YEN.toLocaleString()}円以上で送料無料
          </span>
          ）
        </p>
        <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
          <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          毛入れ用以外の全色、蓄光素材入りで暗闇でやさしく光ります（光り方の強さや光る色は色によって異なります）。光が弱くなったらスマホのライトを数十秒当てるだけで再チャージできます。
        </p>
        <Controller
          name="colorQuantities"
          control={control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                {MAGIC_COLOR_OPTIONS.map((color) => {
                  const value = field.value[color];
                  const imageSrc = COLOR_IMAGE_SRC[color];
                  return (
                    <div
                      key={color}
                      className="w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="relative aspect-square bg-slate-100">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={MAGIC_COLOR_LABELS[color]}
                            fill
                            sizes="128px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Gem className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 p-2">
                        <span className="flex min-h-[2rem] items-start gap-1 text-xs font-medium leading-tight text-slate-900">
                          <span className="line-clamp-2">
                            {color === "furCavity" && subjectType === "object"
                              ? "思い出の品入れ用（空洞・コルク栓付き）"
                              : MAGIC_COLOR_LABELS[color]}
                          </span>
                          {color === "furCavity" && (
                            <InfoModalButton
                              label={
                                subjectType === "object"
                                  ? "思い出の品入れ用フィギュアの使い方を見る"
                                  : "毛入れ用フィギュアの使い方を見る"
                              }
                              title={
                                subjectType === "object"
                                  ? "思い出の品入れ用フィギュアの使い方"
                                  : "毛入れ用フィギュアの使い方"
                              }
                              imageSrc="/guide/fur-cavity-howto.jpg"
                              imageAlt="コルク栓と穴にピンセットで詰める様子のイメージ"
                            >
                              {subjectType === "object" ? (
                                <p>
                                  底面に直径{DEFAULT_BOTTOM_HOLE_DIAMETER_MM}
                                  mmの穴が空いた状態でお届けします。ピンセットなどで思い出の品（花びら、砂、灰など小さなもの）を少しずつ詰めていただき、最後にコルク栓で蓋をしてください。
                                </p>
                              ) : (
                                <p>
                                  底面に直径{DEFAULT_BOTTOM_HOLE_DIAMETER_MM}
                                  mmの穴が空いた状態でお届けします。ピンセットなどで愛犬・愛猫の毛を少しずつ詰めていただき、最後にコルク栓で蓋をしてください。
                                </p>
                              )}
                              <p className="mt-1 text-[10px] text-slate-400">
                                ※画像はイメージを伝えるためのAI生成イラストです（実際の商品写真ではありません）
                              </p>
                            </InfoModalButton>
                          )}
                        </span>
                        <div className="flex shrink-0 items-center justify-center gap-2">
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
                  ストラップ・キーホルダー用の金具穴を追加する（+¥
                  {HARDWARE_ADDON_PRICE_YEN.toLocaleString()}/個）
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  3Dプレビュー生成後、開けたい位置を指定できます
                </span>
              </span>
            </label>
          )}
        />
        {wantsHardware && (
          <Controller
            name="hardwareColor"
            control={control}
            render={({ field }) => (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {HARDWARE_COLOR_OPTIONS.map((option) => (
                  <RadioCard
                    key={option}
                    name={field.name}
                    value={option}
                    checked={field.value === option}
                    onChange={field.onChange}
                    label={HARDWARE_COLOR_LABELS[option]}
                    icon={
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={HARDWARE_COLOR_IMAGE_SRC[option]}
                          alt={HARDWARE_COLOR_LABELS[option]}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          />
        )}
      </fieldset>
    </div>
  );
}
