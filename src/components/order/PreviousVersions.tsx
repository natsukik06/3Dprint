"use client";

import { RotateCcw } from "lucide-react";

export type PreviousVersion = {
  id: string;
  // Small preview images (data URLs or https URLs) shown on the card.
  thumbs: string[];
  label: string;
};

// "前の画像に戻す" -- after 作り直す, the earlier result is kept (in memory, plus the saved draft) so the
// customer can go back to it if the new one turns out worse. Shared by the single-pet, 2-pet and 5-pose
// builders; each owns its own list because what a "version" holds differs per builder.
export function PreviousVersions({
  versions,
  onRestore,
  disabled = false,
}: {
  versions: PreviousVersion[];
  onRestore: (id: string) => void;
  disabled?: boolean;
}) {
  if (versions.length === 0) return null;
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700">
        前に作った画像（作り直す前の画像に戻せます）
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {versions.map((version) => (
          <div key={version.id} className="w-28 shrink-0 space-y-1">
            <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {version.thumbs.slice(0, 4).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full bg-white object-contain"
                />
              ))}
            </div>
            <p className="truncate text-[10px] text-slate-500">{version.label}</p>
            <button
              type="button"
              onClick={() => onRestore(version.id)}
              disabled={disabled}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              この画像に戻す
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
