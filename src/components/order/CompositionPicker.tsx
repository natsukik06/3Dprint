"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  COMPOSITION_NOTE,
  MAX_COMPOSITION_IMAGE_BYTES,
  type CompositionPreset,
} from "@/lib/compositions";
import { downscaleImage } from "@/lib/imageResize";

// "構図（任意）": pick a preset silhouette or upload one's own composition image. The server turns
// it into a pose/arrangement-only reference (see compositionPhrase in gemini.ts).
export function CompositionPicker({
  presets,
  compositionId,
  onCompositionIdChange,
  compositionFile,
  onCompositionFileChange,
}: {
  presets: CompositionPreset[];
  compositionId: string | null;
  onCompositionIdChange: (id: string | null) => void;
  compositionFile: File | null;
  onCompositionFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください");
      return;
    }
    const resized = await downscaleImage(file);
    if (resized.size > MAX_COMPOSITION_IMAGE_BYTES) {
      setError("画像が大きすぎます。別の画像を選んでください");
      return;
    }
    setError(null);
    onCompositionFileChange(resized);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">構図（任意）</legend>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((preset) => {
          const selected = !compositionFile && compositionId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onCompositionIdChange(selected ? null : preset.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors ${
                selected
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              } ${compositionFile ? "opacity-50" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preset.imageUrl}
                alt=""
                className="aspect-square w-full rounded-lg bg-slate-100 object-contain"
              />
              <span className="text-[11px] font-medium leading-tight text-slate-700">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          自分の構図画像を使う
        </button>
        {compositionFile && (
          <span className="flex items-center gap-1 text-xs text-slate-600">
            {compositionFile.name.slice(0, 24)}
            <button
              type="button"
              onClick={() => onCompositionFileChange(null)}
              aria-label="構図の画像を外す"
              className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">{COMPOSITION_NOTE}</p>
    </fieldset>
  );
}
