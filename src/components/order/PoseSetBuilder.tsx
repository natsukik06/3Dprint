"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { signInWithGoogle } from "@/lib/auth";
import { PREVIEW_CREDIT_PRICE_YEN } from "@/lib/creditPacks";
import { clearDraftSlice, loadDraftSlice, saveDraftSlice } from "@/lib/draftStorage";
import type { ImagePayload } from "@/lib/gemini";
import { MAX_CONSECUTIVE_POLL_FAILURES } from "@/lib/generationPolling";
import { POSE_LABELS } from "@/lib/pricing";
import { POSE_OPTIONS, type PetDetails, type Pose, type SubjectType } from "@/types/order";

type PoseModelState =
  | { phase: "starting" }
  // taskId lets a page reload resume polling this exact Tripo job instead of losing track of a
  // credit that's already been spent -- see the restore effect below.
  | { phase: "polling"; progress: number; taskId: string }
  | { phase: "success" }
  | { phase: "error"; message: string };

type BuilderState =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "reviewing"; poseViews: Record<Pose, ImagePayload>; referenceImageUrls: string[] }
  | { phase: "error"; message: string; freeGenerationLimitReached?: boolean };

// What IndexedDB persistence needs to fully restore this builder across a page reload. Only
// "idle"/"reviewing" builder phases are worth saving -- "generating" is a one-shot in-flight
// fetch with nothing to resume (falls back to "idle" on restore) and "error" isn't worth
// resurrecting either.
type SavedPoseSetDraft = {
  builder: { phase: "idle" } | Extract<BuilderState, { phase: "reviewing" }>;
  selected: Pose[];
  poseModels: Partial<Record<Pose, PoseModelState>>;
};

// The 5-pose generation is one long request. If the customer leaves this step (or this component is
// otherwise unmounted) while it runs, the request itself keeps going -- this module-level handle lets
// the next mount pick the result up instead of losing it, and the result is also written to IndexedDB
// the moment it arrives so even a full page reload after completion restores it.
let pendingPoseGeneration: Promise<BuilderState> | null = null;

type PoseSetBuilderProps = {
  photos: File[];
  subject: string;
  subjectType: SubjectType;
  petDetails: PetDetails;
  onGeneratedItem: (
    pose: Pose,
    result: { modelUrl: string; referenceImageUrls: string[] }
  ) => void;
};

// "5ポーズセット" -- unlike DuoBuilder (its own subject/photos, since there's no single subject to
// bind to), this always has exactly ONE subject, so it reads photos/subject/subjectType/petDetails
// as props from the shared draft fields, same as PreviewPanel's mode="ai". Owns only the
// generation-engine state: the 5 pose previews, which ones are selected, and each selected pose's
// independent model-generation progress (started in parallel, polled independently).
export function PoseSetBuilder({
  photos,
  subject,
  subjectType,
  petDetails,
  onGeneratedItem,
}: PoseSetBuilderProps) {
  const { user } = useAuth();
  const credits = useCredits();
  const [builder, setBuilder] = useState<BuilderState>({ phase: "idle" });
  const [selected, setSelected] = useState<Set<Pose>>(new Set(POSE_OPTIONS));
  const [poseModels, setPoseModels] = useState<Partial<Record<Pose, PoseModelState>>>({});
  const [purchasingPreview, setPurchasingPreview] = useState(false);
  const pollTimersRef = useRef<Partial<Record<Pose, ReturnType<typeof setTimeout>>>>({});
  // Gates the save effect below so it can't race ahead and clear/overwrite a saved slice with
  // pre-restore defaults before the async IndexedDB load has actually run (see PreviewPanel's
  // identical hasRestored for the same reason).
  const [hasRestored, setHasRestored] = useState(false);
  const mountedRef = useRef(true);

  async function adoptPendingGeneration(job: Promise<BuilderState>) {
    const result = await job;
    if (pendingPoseGeneration === job) pendingPoseGeneration = null;
    if (!mountedRef.current) return;
    if (result.phase === "reviewing") setSelected(new Set(POSE_OPTIONS));
    setBuilder(result);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Warn before a reload/close while a generation is in flight -- the result would be lost.
  const busy =
    builder.phase === "generating" ||
    Object.values(poseModels).some((s) => s?.phase === "starting");
  useEffect(() => {
    if (!busy) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    return () => {
      Object.values(pollTimersRef.current).forEach((timer) => timer && clearTimeout(timer));
    };
  }, []);

  // Restore the 5-pose review grid, selection, and any still-polling per-pose models from
  // IndexedDB on mount -- resumes polling for anything that was mid-flight.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = pendingPoseGeneration;
      if (pending) {
        // A generation started before this mount is still running -- show it as in progress.
        setBuilder({ phase: "generating" });
        adoptPendingGeneration(pending);
        setHasRestored(true);
        return;
      }
      const saved = await loadDraftSlice<SavedPoseSetDraft>("poseSetDraft");
      if (cancelled) return;
      if (saved) {
        setBuilder(saved.builder);
        setSelected(new Set(saved.selected));
        setPoseModels(saved.poseModels);
        if (saved.builder.phase === "reviewing") {
          for (const [poseKey, state] of Object.entries(saved.poseModels)) {
            if (state?.phase === "polling") {
              pollPoseStatus(poseKey as Pose, state.taskId, saved.builder.referenceImageUrls);
            }
          }
        }
      }
      setHasRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and keep it saved on every change (debounced) while restored. "starting" entries are
  // dropped rather than saved as-is -- there's no taskId yet to resume, so restoring one would
  // leave a permanently-stuck spinner (and anyModeling would keep the retry button disabled
  // forever) instead of just letting the customer click モデル化 again for that pose.
  useEffect(() => {
    if (!hasRestored) return;
    const timer = setTimeout(() => {
      if (builder.phase === "idle" || builder.phase === "reviewing") {
        const savablePoseModels: Partial<Record<Pose, PoseModelState>> = {};
        for (const [poseKey, state] of Object.entries(poseModels)) {
          if (state && state.phase !== "starting") {
            savablePoseModels[poseKey as Pose] = state;
          }
        }
        saveDraftSlice<SavedPoseSetDraft>("poseSetDraft", {
          builder,
          selected: POSE_OPTIONS.filter((pose) => selected.has(pose)),
          poseModels: savablePoseModels,
        });
      } else {
        clearDraftSlice("poseSetDraft");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [hasRestored, builder, selected, poseModels]);

  const ready = photos.length > 0 && subject.trim().length > 0;
  const selectedCount = selected.size;
  const anyModeling = Object.values(poseModels).some(
    (s) => s?.phase === "starting" || s?.phase === "polling"
  );
  const hasEnoughCredits = (credits ?? 0) >= selectedCount;

  function toggleSelected(pose: Pose) {
    if (anyModeling) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pose)) next.delete(pose);
      else next.add(pose);
      return next;
    });
  }

  async function handleGeneratePoses() {
    if (!ready || !user) return;
    Object.values(pollTimersRef.current).forEach((timer) => timer && clearTimeout(timer));
    pollTimersRef.current = {};
    setPoseModels({});
    setBuilder({ phase: "generating" });

    const currentUser = user;
    const job: Promise<BuilderState> = (async (): Promise<BuilderState> => {
      try {
        const idToken = await currentUser.getIdToken();
        const formData = new FormData();
        photos.forEach((file) => formData.append("photos", file));
        formData.append("subject", subject);
        formData.append("subjectType", subjectType);
        formData.append("furColorNote", petDetails.furColorNote ?? "");
        formData.append("breedNote", petDetails.breedNote ?? "");
        formData.append("accessoryNote", petDetails.accessoryNote ?? "");
        formData.append("bodyFeatureNote", petDetails.bodyFeatureNote ?? "");

        const res = await fetch("/api/generate-model-poseset", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) {
          return {
            phase: "error",
            message: json.error ?? "生成に失敗しました",
            freeGenerationLimitReached: json.freeGenerationLimitReached === true,
          };
        }
        const reviewing: Extract<BuilderState, { phase: "reviewing" }> = {
          phase: "reviewing",
          poseViews: json.poseViews as Record<Pose, ImagePayload>,
          referenceImageUrls: (json.referenceImageUrls as string[]) ?? [],
        };
        // Saved right here, not from a render effect: if the customer already left this step, the
        // result must still survive so it is there when they come back.
        await saveDraftSlice<SavedPoseSetDraft>("poseSetDraft", {
          builder: reviewing,
          selected: [...POSE_OPTIONS],
          poseModels: {},
        }).catch(() => {});
        return reviewing;
      } catch (err) {
        return {
          phase: "error",
          message: err instanceof Error ? err.message : "生成に失敗しました",
        };
      }
    })();
    pendingPoseGeneration = job;
    adoptPendingGeneration(job);
  }

  function pollPoseStatus(pose: Pose, taskId: string, referenceImageUrls: string[]) {
    let consecutiveFailures = 0;
    async function tick() {
      try {
        const res = await fetch(`/api/generate-model/${taskId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "ステータス取得に失敗しました");
        consecutiveFailures = 0;

        if (json.status === "success") {
          setPoseModels((prev) => ({ ...prev, [pose]: { phase: "success" } }));
          onGeneratedItem(pose, { modelUrl: json.modelUrl, referenceImageUrls });
        } else if (json.status === "queued" || json.status === "running") {
          setPoseModels((prev) => ({
            ...prev,
            [pose]: { phase: "polling", progress: json.progress ?? 0, taskId },
          }));
          pollTimersRef.current[pose] = setTimeout(tick, 4000);
        } else {
          setPoseModels((prev) => ({
            ...prev,
            [pose]: { phase: "error", message: "モデル生成に失敗しました" },
          }));
        }
      } catch (err) {
        if (++consecutiveFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          pollTimersRef.current[pose] = setTimeout(tick, 4000);
          return;
        }
        setPoseModels((prev) => ({
          ...prev,
          [pose]: {
            phase: "error",
            message: err instanceof Error ? err.message : "ステータス取得に失敗しました",
          },
        }));
      }
    }
    pollTimersRef.current[pose] = setTimeout(tick, 4000);
  }

  async function handleModelSelected() {
    if (builder.phase !== "reviewing" || !user || selectedCount === 0) return;
    const { poseViews, referenceImageUrls } = builder;
    const poses = POSE_OPTIONS.filter((pose) => selected.has(pose));

    setPoseModels((prev) => {
      const next = { ...prev };
      for (const pose of poses) next[pose] = { phase: "starting" };
      return next;
    });

    const idToken = await user.getIdToken();
    await Promise.all(
      poses.map(async (pose) => {
        try {
          const res = await fetch("/api/generate-model-poseset/confirm", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: poseViews[pose] }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "生成開始に失敗しました");
          pollPoseStatus(pose, json.taskId as string, referenceImageUrls);
        } catch (err) {
          setPoseModels((prev) => ({
            ...prev,
            [pose]: {
              phase: "error",
              message: err instanceof Error ? err.message : "生成開始に失敗しました",
            },
          }));
        }
      })
    );
  }

  async function handleBuyPreviewCredit() {
    if (!user || purchasingPreview) return;
    setPurchasingPreview(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "preview", returnTo: "/order" }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "決済ページの作成に失敗しました");
      window.location.assign(json.url as string);
    } catch (err) {
      console.error("preview credit purchase failed", err);
      setPurchasingPreview(false);
    }
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        ログインして生成する
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {builder.phase !== "reviewing" && (
        <button
          type="button"
          onClick={handleGeneratePoses}
          disabled={!ready || builder.phase === "generating"}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {builder.phase === "generating"
            ? "5ポーズを生成中..."
            : builder.phase === "error"
              ? "もう一度5ポーズを生成する（無料）"
              : "5ポーズを生成する（無料）"}
        </button>
      )}

      {builder.phase === "generating" && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-xs text-slate-500">5ポーズを生成しています...</p>
        </div>
      )}

      {builder.phase === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-600">{builder.message}</p>
          {builder.freeGenerationLimitReached && (
            <button
              type="button"
              onClick={handleBuyPreviewCredit}
              disabled={purchasingPreview}
              className="mt-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {purchasingPreview
                ? "準備中..."
                : `¥${PREVIEW_CREDIT_PRICE_YEN}で追加のプレビューを生成する`}
            </button>
          )}
        </div>
      )}

      {builder.phase === "reviewing" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            作りたいポーズだけチェックを入れてください（外すとそのポーズは作りません）
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POSE_OPTIONS.map((pose) => {
              const image = builder.poseViews[pose];
              const state = poseModels[pose];
              return (
                <label
                  key={pose}
                  className={`relative block cursor-pointer overflow-hidden rounded-xl border-2 transition-colors ${
                    selected.has(pose)
                      ? "border-slate-800"
                      : "border-slate-200 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(pose)}
                    onChange={() => toggleSelected(pose)}
                    disabled={anyModeling}
                    className="absolute left-2 top-2 z-10 h-4 w-4 accent-slate-800"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${image.mimeType};base64,${image.data}`}
                    alt={POSE_LABELS[pose]}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between bg-white px-2 py-1">
                    <span className="text-xs font-medium text-slate-700">
                      {POSE_LABELS[pose]}
                    </span>
                    {state?.phase === "starting" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    )}
                    {state?.phase === "polling" && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        {state.progress}%
                      </span>
                    )}
                    {state?.phase === "success" && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    {state?.phase === "error" && <X className="h-3.5 w-3.5 text-red-600" />}
                  </div>
                  {state?.phase === "error" && (
                    <p className="bg-red-50 px-2 py-1 text-[10px] text-red-600">
                      {state.message}
                    </p>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGeneratePoses}
              disabled={anyModeling}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              作り直す（無料）
            </button>
            <button
              type="button"
              onClick={handleModelSelected}
              disabled={selectedCount === 0 || anyModeling || !hasEnoughCredits}
              className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {anyModeling
                ? "作成中..."
                : `選んだ${selectedCount}体をモデル化してカートに追加（${selectedCount}クレジット）`}
            </button>
          </div>
          {!hasEnoughCredits && selectedCount > 0 && (
            <p className="text-center text-xs text-amber-600">
              クレジットが不足しています（{selectedCount}体には{selectedCount}クレジット必要です）。購入してからお試しください。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
