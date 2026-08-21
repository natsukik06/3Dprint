"use client";

import { useFormContext } from "react-hook-form";
import type { OrderFormValues } from "@/types/order";

type FieldDef = {
  name: "furColorNote" | "breedNote" | "accessoryNote" | "bodyFeatureNote";
  label: string;
  placeholder: string;
  note?: string;
};

const FIELDS: FieldDef[] = [
  {
    name: "furColorNote",
    label: "毛色・柄",
    placeholder: "例：茶色、お腹だけ白いです",
  },
  {
    name: "breedNote",
    label: "犬種・ミックス",
    placeholder: "例：チワワとポメラニアンのミックスです",
  },
  {
    name: "accessoryNote",
    label: "服・首輪などの扱い",
    placeholder: "例：服は脱がせて、首輪はそのまま再現してください",
    note: "※服の柄などは権利上の理由で再現できない場合があります",
  },
  {
    name: "bodyFeatureNote",
    label: "しっぽ・耳など体の特徴",
    placeholder: "例：しっぽは短めです、耳は片方だけ立っています",
  },
];

export function PetDetailsFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">
        ペットの特徴（任意）
      </legend>
      <p className="text-xs text-slate-500">
        詳しく書いていただくほど、写真だけでは伝わりにくい特徴まで仕上がりに反映されやすくなります
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={field.name}
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              {field.label}
            </label>
            <textarea
              id={field.name}
              rows={2}
              {...register(field.name)}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            {field.note && (
              <p className="mt-0.5 text-[10px] text-slate-400">{field.note}</p>
            )}
            {errors[field.name] && (
              <p className="mt-0.5 text-xs text-red-600">
                {errors[field.name]?.message}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400">
        ※記載いただいても、完全な再現が難しい場合がございます。あらかじめご了承ください。
      </p>
    </fieldset>
  );
}
