"use client";

import { Check, Sparkles } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { PetDetailsFields } from "@/components/order/PetDetailsFields";
import { RadioCard } from "@/components/ui/RadioCard";
import { POSE_LABELS, SUBJECT_TYPE_LABELS } from "@/lib/pricing";
import {
  MODEL_STYLE_LABELS,
  MODEL_STYLE_OPTIONS,
  POSE_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  type ModelStyle,
  type OrderFormValues,
} from "@/types/order";

const MODEL_STYLE_HINTS: Record<ModelStyle, string> = {
  deformed: "丸っこくてかわいいトイ調",
  realistic: "写真そのままのプロポーション",
};

// Real examples (same subject -- ちゃろ -- generated in both styles) so the choice is shown, not
// just described. Beats a plain text radio button for a purely visual/aesthetic decision like
// this one.
const MODEL_STYLE_EXAMPLE_IMAGE: Record<ModelStyle, string> = {
  deformed:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fcharo-premade-starryBlue.png?alt=media&token=3270947a-0719-4f24-a0fa-8c64c0c403f0",
  realistic:
    "https://firebasestorage.googleapis.com/v0/b/diy-figure-app.firebasestorage.app/o/previews%2Fstyle-example-realistic.png?alt=media&token=eba066e0-5f0c-49a7-9690-47cb08ff6a6d",
};

// pet's value is purely a name/label for the customer's own records now -- it's never fed into
// the AI generation prompt as a species/description (see subjectPhrase in src/lib/gemini.ts),
// after a customer typed over the old "例：たれ耳のうさぎ" placeholder-style text while uploading
// a dog photo and got back a rabbit. object's value IS still used as the generation prompt's
// description, since an arbitrary item can genuinely be ambiguous from a photo alone.
const SUBJECT_TYPE_LABEL_TEXT: Record<(typeof SUBJECT_TYPE_OPTIONS)[number], string> = {
  pet: "お名前（必須・注文管理用）",
  object: "何を作りますか？",
};
const SUBJECT_TYPE_PLACEHOLDER: Record<(typeof SUBJECT_TYPE_OPTIONS)[number], string> = {
  pet: "例：ポチ",
  object: "例：旅行のお土産のマグカップ",
};

// What to make + its pose -- shared by SpecOptions (for ai/custom, hidden for duo which collects
// its own subject A/B) and the inline "自分オリジナルモデルを作成する" model-creation flow, so
// both places stay in sync instead of drifting apart.
export function SubjectPoseFields({
  hideModelOptions = false,
}: {
  // The 5-pose-set flow always generates all 5 poses in the same デフォルメ style regardless of
  // these fields (generatePoseSetViews takes no style/pose/self-standing params) -- showing them
  // there would let the customer "choose" a pose or style that silently has no effect.
  hideModelOptions?: boolean;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>();
  const subjectType = useWatch({ control, name: "subjectType" }) ?? "pet";

  return (
    <>
      <fieldset className="min-w-0 space-y-2">
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
        <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
          {SUBJECT_TYPE_LABEL_TEXT[subjectType]}
        </label>
        <input
          id="subject"
          type="text"
          placeholder={SUBJECT_TYPE_PLACEHOLDER[subjectType]}
          {...register("subject")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {subjectType === "pet" && (
          <p className="text-xs text-slate-500">
            仕上がりは写真から判断するので、ここは注文の管理用のお名前で大丈夫です。
          </p>
        )}
        {errors.subject && <p className="text-sm text-red-600">{errors.subject.message}</p>}
      </div>

      {!hideModelOptions && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Sparkles className="h-4 w-4 text-amber-500" />
            仕上がりのスタイルを選ぼう
          </legend>
          <p className="text-xs text-slate-500">
            同じ「ちゃろ」を2つのスタイルで作ってみました。見比べて好きな方を選んでください
          </p>
          <Controller
            name="modelStyle"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-3">
                {MODEL_STYLE_OPTIONS.map((option) => {
                  const selected = field.value === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => field.onChange(option)}
                      className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all ${
                        selected
                          ? "border-transparent bg-gradient-to-br from-amber-400 via-pink-400 to-sky-400 shadow-lg shadow-amber-200/50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className={selected ? "m-[3px] rounded-[14px] bg-white" : ""}>
                        <div className="relative aspect-square overflow-hidden rounded-t-[14px] bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={MODEL_STYLE_EXAMPLE_IMAGE[option]}
                            alt={`${MODEL_STYLE_LABELS[option]}の例（ちゃろ）`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          {selected && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-sm font-bold text-slate-900">
                            {MODEL_STYLE_LABELS[option]}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                            {MODEL_STYLE_HINTS[option]}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </fieldset>
      )}

      <PetDetailsFields />

      {!hideModelOptions && subjectType !== "object" && (
        <fieldset className="min-w-0 space-y-2">
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
                  <p className="text-sm text-red-600">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />
        </fieldset>
      )}

      {!hideModelOptions && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-sm font-medium text-slate-700">置き方（任意）</legend>
          <Controller
            name="wantsSelfStanding"
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
                    棚に置いても自立する形にする
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    キーホルダーとして使うだけなら不要です。机や棚に飾りたい場合はオンにしてください（足元が安定するようAIが調整します）
                  </span>
                </span>
              </label>
            )}
          />
        </fieldset>
      )}
    </>
  );
}
