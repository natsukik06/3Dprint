"use client";

import { useEffect, useState } from "react";
import type { ShowcaseItemPublic } from "@/types/showcase";

type View = "photo" | "model" | "customer";

// One 作成例 card: switches between the real photo, the 3D model (model-viewer, rotatable/zoomable)
// and the customer's reference photo, whichever exist. Tapping a still image enlarges it.
export function ShowcaseCard({ item }: { item: ShowcaseItemPublic }) {
  const views: { id: View; label: string }[] = [];
  if (item.photoUrl) views.push({ id: "photo", label: "完成品" });
  if (item.modelUrl) views.push({ id: "model", label: "3Dモデル" });
  if (item.customerImageUrl) views.push({ id: "customer", label: "元の写真" });

  const [view, setView] = useState<View>(views[0]?.id ?? "model");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (view === "model") import("@google/model-viewer");
  }, [view]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const stillUrl = view === "photo" ? item.photoUrl : view === "customer" ? item.customerImageUrl : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#d9cbb0] bg-white dark:border-[#232726] dark:bg-[#121415]">
      <div className="relative aspect-square bg-[#f4ecdc] dark:bg-white/5">
        {stillUrl ? (
          <button
            type="button"
            onClick={() => setZoom(stillUrl)}
            className="block h-full w-full cursor-zoom-in"
            aria-label={`${item.title}の写真を拡大`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
            <img
              src={stillUrl}
              alt={view === "photo" ? `${item.title}の完成品写真` : `${item.title}の元の写真`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <model-viewer
            src={item.modelUrl}
            alt={`${item.title}の3Dモデル`}
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
      {views.length > 1 && (
        <div className="flex gap-1 px-3 pt-3" role="tablist" aria-label="表示の切り替え">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === v.id
                  ? "bg-[#0f766e] text-white dark:bg-[#7fd8cb] dark:text-[#0a0a0c]"
                  : "bg-[#f4ecdc] text-[#6b5c40] hover:text-[#3f3424] dark:bg-white/10 dark:text-[#9fb0ae]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div className="px-3 py-3">
        <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
        {item.caption && (
          <p className="mt-1 text-xs leading-6 text-[#6b5c40] dark:text-[#9fb0ae]">{item.caption}</p>
        )}
        {view === "model" && (
          <p className="mt-1 text-[11px] text-[#8a7c5e] dark:text-[#6d7c79]">
            ドラッグで回転・ピンチで拡大できます
          </p>
        )}
      </div>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
          <img src={zoom} alt={item.title} className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-[#3f3424]"
          >
            閉じる
          </button>
        </div>
      )}
    </article>
  );
}
