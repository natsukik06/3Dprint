"use client";

import { Gem, Minus, Moon, Plus } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { SubjectPoseFields } from "@/components/order/SubjectPoseFields";
import { InfoModalButton } from "@/components/ui/InfoModalButton";
import { RadioCard } from "@/components/ui/RadioCard";
import { colorImageSrc, colorLabel, colorPriceBySizeMap } from "@/lib/colorSettings";
import { assignmentFor, normalizeAssignments } from "@/lib/hardwareSplit";
import { DEFAULT_COLOR_IMAGE_SRC } from "@/lib/colorSwatches";
import {
  ADDITIONAL_UNIT_PRICE_YEN,
  ENGRAVING_PRICE_YEN,
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  MAGIC_COLOR_LABELS,
  SOLID_PRICE_YEN,
  formatYen,
  getTotalQuantity,
} from "@/lib/pricing";
import { useColorSettings } from "@/lib/useColorSettings";
import {
  AVAILABLE_SIZE_OPTIONS,
  DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
  ENGRAVING_FONT_OPTIONS,
  HARDWARE_COLOR_LABELS,
  HARDWARE_COLOR_OPTIONS,
  MAGIC_COLOR_OPTIONS,
  MAX_ENGRAVING_TEXT_LENGTH,
  MAX_TOTAL_QUANTITY,
  SIZE_LABELS,
  SOLID_SIZE_OPTIONS,
  type EngravingFont,
  type HardwareColor,
  type MagicColor,
  type OrderFormValues,
  type SolidSizeOption,
} from "@/types/order";

// The color picker groups into tabs once there were too many colors for one horizontal row to
// browse comfortably -- the original space/glitter lineup (all genuinely glow-in-the-dark) vs.
// furCavity (hollow/clear, doesn't glow -- just a cork-sealed cavity for packing fur/keepsakes in)
// vs. the newer black/monochrome lineup aimed at a more grown-up, masculine look (see pricing.ts's
// MAGIC_COLOR_LABELS for the per-color descriptions). furCavity gets its own tab (filtered out of
// the "glow" one) since it was previously mislabeled as one of the glowing colors even though it
// doesn't glow at all -- and since it's the only tab hidden entirely for solid sizes below.
const COLOR_GROUPS: { id: string; label: string; colors: readonly MagicColor[] }[] = [
  {
    id: "clear",
    label: "クリアカラー",
    colors: [
      "pureClear",
      "frosted",
      "smokeOnyx",
      "clearBlue",
      "clearRed",
      "clearYellow",
      "clearPink",
      "clearGreen",
      "clearPurple",
      "clearOrange",
    ],
  },
  {
    id: "solid",
    label: "ソリッド・ラメ",
    colors: ["pureBlack", "pureWhite", "stardustBlack"],
  },
  {
    id: "glow",
    label: "蓄光カラー",
    colors: [
      "starryBlue",
      "nebulaPink",
      "clearAurora",
      "galaxyGreen",
      "cometOrange",
      "cosmicPurple",
      "marsRed",
    ],
  },
  {
    id: "furCavity",
    label: "毛入れ用",
    colors: ["furCavity"],
  },
];

// Whether the color swatch row (see colorScrollRef below) is scrolled to either edge -- a
// pointer-events-none fade overlay is only shown on the edges that still have hidden content, so
// it disappears once there's nothing more to scroll to in that direction.
function readScrollEdges(el: HTMLDivElement | null): { atStart: boolean; atEnd: boolean } {
  if (!el) return { atStart: true, atEnd: true };
  // Threshold wider than 1px -- the row's -mx-1/px-1 negative-margin trick (needed so the first/
  // last card's snap point lines up flush with the section's edge) leaves a few px of inherent
  // scrollLeft at rest, which would otherwise read as "scrolled" even with nothing more to show.
  const threshold = 8;
  return {
    atStart: el.scrollLeft <= threshold,
    atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold,
  };
}

const HARDWARE_COLOR_IMAGE_SRC: Record<HardwareColor, string> = {
  silver: "/hardware/silver.jpg",
  gold: "/hardware/gold.jpg",
  roseGold: "/hardware/roseGold.jpg",
  clear: "/hardware/clear.jpg",
};

// CSS font stacks for the live text preview below -- with a same-family fallback in case a
// visitor's device doesn't have the exact named font, so the preview never silently falls back to
// a generic system font that looks nothing like what'll actually be engraved.
const ENGRAVING_FONT_STACK: Record<EngravingFont, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  "Arial Black": "'Arial Black', Arial, sans-serif",
  "Arial Narrow": "'Arial Narrow', Arial, sans-serif",
  "Arial Rounded MT Bold": "'Arial Rounded MT Bold', Arial, sans-serif",
  "Comic Sans MS": "'Comic Sans MS', 'Comic Sans', cursive",
  Georgia: "Georgia, 'Times New Roman', serif",
  "Times New Roman": "'Times New Roman', Times, serif",
};

export function SpecOptions({
  hideSubjectAndPose = false,
}: {
  // Duo mode ("おそろいセット") already collects subject A/B, pose, and pet details in its own
  // step (see DuoBuilder.tsx) -- this hides the equivalent single-subject fields here so they
  // aren't asked for (and don't get submitted empty/stale) a second time.
  hideSubjectAndPose?: boolean;
} = {}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  const colorQuantities = useWatch({ control, name: "colorQuantities" });
  const sizeOption = useWatch({ control, name: "sizeOption" });
  const wantsHardware = useWatch({ control, name: "wantsHardware" });
  const wantsEngraving = useWatch({ control, name: "wantsEngraving" });
  const engravingText = useWatch({ control, name: "engravingText" });
  const engravingFont = useWatch({ control, name: "engravingFont" });
  const subjectType = useWatch({ control, name: "subjectType" }) ?? "pet";
  const totalQuantity = getTotalQuantity(colorQuantities);
  const isSolidSize = (SOLID_SIZE_OPTIONS as readonly string[]).includes(sizeOption);
  const { settings: colorSettings } = useColorSettings();
  const colorPriceBySize = colorPriceBySizeMap(colorSettings);
  // Solid sizes have no cavity, so the furCavity tab has nothing valid to offer them. Colors the
  // shop owner has hidden from /admin/colors (see useColorSettings) are dropped the same way, and
  // a group left with nothing to show (e.g. 蓄光カラー while every glow color is off) disappears
  // entirely rather than rendering an empty tab.
  const visibleColorGroups = COLOR_GROUPS.map((group) => ({
    ...group,
    colors: group.colors.filter(
      (color) => colorSettings[color].enabled && (!isSolidSize || color !== "furCavity")
    ),
  })).filter((group) => group.colors.length > 0);
  const [activeColorGroupId, setActiveColorGroupId] = useState(COLOR_GROUPS[0].id);
  const activeColorGroup =
    visibleColorGroups.find((g) => g.id === activeColorGroupId) ?? visibleColorGroups[0];

  // Drives the left/right fade cues on the color swatch row below -- the row scrolls
  // horizontally with no scrollbar visible on most devices, so without this a customer can
  // easily miss that there are more colors off-screen to the right (see the "デザイン工学的" UI
  // review this was requested from).
  const colorScrollRef = useRef<HTMLDivElement>(null);
  const [colorScrollEdges, setColorScrollEdges] = useState({ atStart: true, atEnd: true });

  // Switching color tabs swaps the row's content and resets its scroll position, so the fade
  // state has to be recomputed then too, not just on scroll.
  useEffect(() => {
    setColorScrollEdges(readScrollEdges(colorScrollRef.current));
  }, [activeColorGroupId, activeColorGroup.colors.length]);

  // Strap (金具) choices per resin color. Kept in step with the chosen colors/quantities, and turned
  // into one cart item per strap color when the set is added -- see src/lib/hardwareSplit.ts.
  const hardwareAssignments = useWatch({ control, name: "hardwareAssignments" });
  useEffect(() => {
    if (!wantsHardware) return;
    const next = normalizeAssignments(hardwareAssignments, colorQuantities);
    if (JSON.stringify(next) !== JSON.stringify(hardwareAssignments ?? {})) {
      setValue("hardwareAssignments", next);
    }
  }, [wantsHardware, colorQuantities, hardwareAssignments, setValue]);

  function changeStrap(color: MagicColor, strap: HardwareColor, delta: 1 | -1) {
    const qty = colorQuantities[color] ?? 0;
    const current = assignmentFor(hardwareAssignments, color, qty);
    const strapped = HARDWARE_COLOR_OPTIONS.reduce((sum, s) => sum + (current[s] ?? 0), 0);
    const n = current[strap] ?? 0;
    if (delta > 0 && strapped >= qty) return;
    if (delta < 0 && n <= 0) return;
    setValue(
      "hardwareAssignments",
      normalizeAssignments({ ...hardwareAssignments, [color]: { ...current, [strap]: n + delta } }, colorQuantities)
    );
  }
  return (
    <div className="space-y-6">
      {!hideSubjectAndPose && <SubjectPoseFields />}

      <fieldset className="min-w-0 space-y-2">
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
                    hint={
                      (option as string) === "M"
                        ? `¥${FIGURE_PRICE_YEN.toLocaleString()}〜`
                        : `¥${SOLID_PRICE_YEN[option as SolidSizeOption].toLocaleString()}`
                    }
                    onChange={(value) => {
                      field.onChange(value);
                      // Solid (中実) sizes have no cavity, so furCavity can't be selected for
                      // them -- clear it out if it was set while a hollow (M) size was active.
                      const switchingToSolid = (
                        SOLID_SIZE_OPTIONS as readonly string[]
                      ).includes(value);
                      if (switchingToSolid && colorQuantities.furCavity > 0) {
                        setValue("colorQuantities", {
                          ...colorQuantities,
                          furCavity: 0,
                        });
                      }
                    }}
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

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          魔法のカラー・個数
        </legend>
        <>
            <p className="text-xs text-slate-500">
              同じ形状を複数のカラーで注文できます（
              {isSolidSize ? (
                <>
                  1個¥
                  {SOLID_PRICE_YEN[sizeOption as SolidSizeOption].toLocaleString()}
                  （個数分がそのまま合計になります）
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
            {activeColorGroupId === "glow" && (
              <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
                <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                全色、蓄光素材入りで暗闇でやさしく光ります（光り方の強さや光る色は色によって異なります）。光が弱くなったらスマホのライトを数十秒当てるだけで再チャージできます。
              </p>
            )}
            <div className="flex gap-2 rounded-lg bg-slate-100 p-1 text-xs font-medium">
              {visibleColorGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveColorGroupId(group.id)}
                  className={`flex-1 rounded-md py-1.5 transition-colors ${
                    activeColorGroupId === group.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <Controller
              name="colorQuantities"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <div className="relative">
                  <div
                    ref={colorScrollRef}
                    onScroll={() => setColorScrollEdges(readScrollEdges(colorScrollRef.current))}
                    className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
                  >
                {activeColorGroup.colors.map((color) => {
                  const value = field.value[color];
                  const imageSrc = colorImageSrc(colorSettings, color, DEFAULT_COLOR_IMAGE_SRC[color]);
                  const label = colorLabel(colorSettings, color, MAGIC_COLOR_LABELS[color]);
                  return (
                    <div
                      key={color}
                      className="w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="relative aspect-square bg-slate-100">
                        {imageSrc ? (
                          imageSrc.startsWith("http") ? (
                            // Admin-uploaded swatch photo, hosted on Firebase Storage -- not a
                            // next.config-whitelisted remote domain, same reasoning as the other
                            // Storage-hosted <img> usages in this codebase (see products/page.tsx).
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageSrc}
                              alt={label}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Image
                              src={imageSrc}
                              alt={label}
                              fill
                              sizes="128px"
                              className="object-cover"
                            />
                          )
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
                              : label}
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
                        {colorPriceBySize[color][sizeOption] > 0 && (
                          <span className="block text-[10px] font-semibold text-amber-600">
                            +{formatYen(colorPriceBySize[color][sizeOption])}
                          </span>
                        )}
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
                            aria-label={`${label}を減らす`}
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
                            aria-label={`${label}を増やす`}
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
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent transition-opacity ${
                      colorScrollEdges.atStart ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent transition-opacity ${
                      colorScrollEdges.atEnd ? "opacity-0" : "opacity-100"
                    }`}
                  />
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
        </>
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
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
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              色ごとに、金具の種類と個数を選べます。選ばなかった分は金具なしでお届けします。
            </p>
            {MAGIC_COLOR_OPTIONS.filter((color) => (colorQuantities?.[color] ?? 0) > 0).map((color) => {
              const qty = colorQuantities[color] ?? 0;
              const assigned = assignmentFor(hardwareAssignments, color, qty);
              const strapped = HARDWARE_COLOR_OPTIONS.reduce((sum, s) => sum + (assigned[s] ?? 0), 0);
              return (
                <div key={color} className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {colorLabel(colorSettings, color, MAGIC_COLOR_LABELS[color])}
                    <span className="ml-1 text-xs font-normal text-slate-500">× {qty}個</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {HARDWARE_COLOR_OPTIONS.map((strap) => {
                      const n = assigned[strap] ?? 0;
                      return (
                        <div key={strap} className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 p-2">
                          <span className="relative h-10 w-10 overflow-hidden rounded-md bg-slate-100">
                            <Image
                              src={HARDWARE_COLOR_IMAGE_SRC[strap]}
                              alt={HARDWARE_COLOR_LABELS[strap]}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </span>
                          <span className="text-[11px] leading-tight text-slate-700">
                            {HARDWARE_COLOR_LABELS[strap]}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeStrap(color, strap, -1)}
                              disabled={n <= 0}
                              aria-label={`${HARDWARE_COLOR_LABELS[strap]}を減らす`}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-4 text-center text-sm tabular-nums text-slate-900">{n}</span>
                            <button
                              type="button"
                              onClick={() => changeStrap(color, strap, 1)}
                              disabled={strapped >= qty}
                              aria-label={`${HARDWARE_COLOR_LABELS[strap]}を増やす`}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    金具あり {strapped}個／金具なし {qty - strapped}個
                  </p>
                </div>
              );
            })}
            {(errors.hardwareAssignments as { message?: string } | undefined)?.message && (
              <p className="text-sm text-red-600">
                {(errors.hardwareAssignments as { message?: string }).message}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          名前刻印（任意）
        </legend>
        <Controller
          name="wantsEngraving"
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
                  お名前・メッセージを刻印する（+¥
                  {ENGRAVING_PRICE_YEN.toLocaleString()}/個）
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  台座などの目立つ位置に、選んだフォントで刻印します
                </span>
              </span>
            </label>
          )}
        />
        {wantsEngraving && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="space-y-1.5">
              <label
                htmlFor="engravingText"
                className="block text-xs font-medium text-slate-700"
              >
                刻印する文字（{MAX_ENGRAVING_TEXT_LENGTH}文字以内）
              </label>
              <input
                id="engravingText"
                type="text"
                maxLength={MAX_ENGRAVING_TEXT_LENGTH}
                placeholder="例：Mochi"
                {...register("engravingText")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
              {errors.engravingText && (
                <p className="text-sm text-red-600">
                  {errors.engravingText.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="engravingFont"
                className="block text-xs font-medium text-slate-700"
              >
                フォント
              </label>
              <select
                id="engravingFont"
                {...register("engravingFont")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              >
                {ENGRAVING_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-[10px] text-slate-400">イメージ</p>
              <p
                className="truncate text-2xl text-slate-900"
                style={{
                  fontFamily:
                    ENGRAVING_FONT_STACK[engravingFont as EngravingFont],
                }}
              >
                {engravingText?.trim() || "Mochi"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                ※フォントのイメージです。実際の仕上がり（サイズ・彫りの深さ）とは多少異なります
              </p>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
