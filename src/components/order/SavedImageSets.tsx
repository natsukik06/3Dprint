"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ImagePayload, ShapeRiskAssessment } from "@/lib/gemini";
import { MODEL_STYLE_LABELS, type ModelStyle } from "@/types/order";

export type SavedSetKind = "single" | "duo" | "poseset";

type Summary = {
  id: string;
  kind: SavedSetKind;
  style: ModelStyle | null;
  subject: string;
  createdAtMs: number;
  thumbs: string[];
};

export type LoadedImageSet = {
  id: string;
  kind: SavedSetKind;
  style: ModelStyle | null;
  subject: string;
  referenceImageUrls: string[];
  riskAssessment: ShapeRiskAssessment | null;
  images: Record<string, ImagePayload>;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "保存した画像セット" -- every set the customer generated is saved to their ACCOUNT by the server (see
// src/lib/imageSets.ts), so after paying, reloading or switching device they can pick it up again here
// instead of generating (and possibly paying) twice. Newest 12 are kept.
export function SavedImageSets({
  kind,
  onLoad,
  refreshKey,
  disabled = false,
}: {
  kind: SavedSetKind;
  onLoad: (set: LoadedImageSet) => void;
  // Change this (e.g. the builder's phase) to re-fetch after a new set has just been saved.
  refreshKey?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<Summary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      if (!user) throw new Error("ログインが必要です");
      const idToken = await user.getIdToken();
      return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` } });
    },
    [user]
  );

  useEffect(() => {
    if (!user || !open) return;
    let cancelled = false;
    authedFetch(`/api/image-sets?kind=${kind}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setSets((json.sets as Summary[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setSets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, open, kind, refreshKey, authedFetch]);

  if (!user) return null;

  async function use(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await authedFetch(`/api/image-sets/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "読み込めませんでした");
      onLoad(json as LoadedImageSet);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込めませんでした");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await authedFetch(`/api/image-sets/${id}`, { method: "DELETE" });
      setSets((prev) => (prev ?? []).filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-700"
        aria-expanded={open}
      >
        <span>
          保存した画像セットから選ぶ
          <span className="ml-1 font-normal text-slate-500">（作った画像は、アカウントに自動で保存されます）</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-200 p-3">
          {sets === null && <p className="text-xs text-slate-500">読み込み中...</p>}
          {sets !== null && sets.length === 0 && (
            <p className="text-xs text-slate-500">まだ保存した画像セットはありません。</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(sets ?? []).map((s) => (
              <div key={s.id} className="space-y-1.5 rounded-lg border border-slate-200 p-2">
                <div className="grid grid-cols-4 gap-0.5 overflow-hidden rounded border border-slate-200">
                  {s.thumbs.slice(0, 4).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" className="aspect-square w-full bg-white object-contain" />
                  ))}
                </div>
                <p className="truncate text-[11px] text-slate-600">
                  {formatDate(s.createdAtMs)}・{s.style ? MODEL_STYLE_LABELS[s.style] : "—"}・{s.subject}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => use(s.id)}
                    disabled={disabled || busyId === s.id}
                    className="flex-1 rounded-md bg-slate-800 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {busyId === s.id ? "読み込み中..." : "この画像セットを使う"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={busyId === s.id}
                    aria-label="この画像セットを削除"
                    className="rounded-md border border-slate-300 bg-white px-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
