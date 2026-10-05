"use client";

import { AlertTriangle, Loader2, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { PhotoUploader } from "@/components/order/PhotoUploader";
import { signInWithGoogle } from "@/lib/auth";
import { PREVIEW_CREDIT_PRICE_YEN } from "@/lib/creditPacks";
import { CompositionPicker } from "@/components/order/CompositionPicker";
import { DUO_COMPOSITIONS } from "@/lib/compositions";
import { loadDraftSlice, saveDraftSlice } from "@/lib/draftStorage";
import { MAX_CONSECUTIVE_POLL_FAILURES } from "@/lib/generationPolling";
import { SCENE_LAYOUT_LABELS } from "@/lib/pricing";
import {
  SCENE_LAYOUT_OPTIONS,
  type ColorQuantities,
  type MagicColor,
  type OrderFormValues,
  type SceneLayout,
} from "@/types/order";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ImagePayload, ShapeRiskAssessment, View } from "@/lib/gemini";

const VIEWS: View[] = ["front", "left", "back", "right"];
const VIEW_LABELS: Record<View, string> = {
  front: "正面",
  left: "左側面",
  back: "背面",
  right: "右側面",
};

type GeneratedResult = {
  modelUrl: string;
  finishedPreviewUrls: Partial<Record<MagicColor, string>>;
  referenceImageUrls: string[];
};

// What IndexedDB persistence needs to fully restore an in-progress duo build across a page
// reload -- unlike PreviewPanel's ModelState, this also has to carry the two subjects'
// photos/names/layout, since DuoBuilder (unlike "ai"/"custom" mode) owns those itself rather than
// reading them from the shared draft fields.
type SavedDuoDraft = {
  photosA: File[];
  photosB: File[];
  subjectA: string;
  subjectB: string;
  layout: SceneLayout;
  modelState:
    | { phase: "idle" }
    | {
        phase: "reviewingViews";
        views: Record<View, ImagePayload>;
        referenceImageUrls: string[];
        riskAssessment: ShapeRiskAssessment | null;
      }
    | { phase: "polling"; taskId: string; referenceImageUrls: string[] };
};

type ModelState =
  | { phase: "idle" }
  | { phase: "starting" }
  | {
      phase: "reviewingViews";
      views: Record<View, ImagePayload>;
      referenceImageUrls: string[];
      confirming: boolean;
      riskAssessment: ShapeRiskAssessment | null;
      riskAcknowledged: boolean;
    }
  | { phase: "polling"; progress: number }
  | { phase: "success"; modelUrl: string }
  | { phase: "error"; message: string; freeGenerationLimitReached?: boolean };

// Small schematic diagrams, not product photos -- no real "おそろいセット" pieces exist yet to
// photograph, so these show the ARRANGEMENT being chosen (two dots relative to each other), not
// a promise of exact likeness.
function LayoutIcon({ layout }: { layout: SceneLayout }) {
  return (
    <svg viewBox="0 0 64 40" className="h-8 w-14" aria-hidden>
      <rect width="64" height="40" rx="6" className="fill-slate-100" />
      {layout === "sideBySide" && (
        <>
          <circle cx="22" cy="20" r="9" className="fill-slate-400" />
          <circle cx="42" cy="20" r="9" className="fill-slate-500" />
        </>
      )}
      {layout === "snuggled" && (
        <>
          <circle cx="26" cy="20" r="10" className="fill-slate-400" />
          <circle cx="38" cy="20" r="10" className="fill-slate-500" />
        </>
      )}
      {layout === "stacked" && (
        <>
          <circle cx="26" cy="24" r="10" className="fill-slate-400" />
          <circle cx="38" cy="14" r="8" className="fill-slate-500" />
        </>
      )}
    </svg>
  );
}

type DuoBuilderProps = {
  colorQuantities: ColorQuantities;
  onGenerated: (result: GeneratedResult | null) => void;
  // Preselected composition preset (from /order?composition=<id>); the customer can still change it.
  initialCompositionId?: string | null;
};

// "おそろいセット" -- two different pets, sculpted together into one figurine. Owns its own
// photo/subject/layout state (unlike PreviewPanel's AI mode, which reads those from the shared
// RHF draft fields) since there's no single "subject"/"photos" pair to bind to here; once
// generation succeeds it writes the combined subject name into the shared `subject` field so the
// rest of the wizard (cart row, pricing, packing slip) sees it exactly like any other item.
export function DuoBuilder({
  colorQuantities,
  onGenerated,
  initialCompositionId,
}: DuoBuilderProps) {
  const [photosA, setPhotosA] = useState<File[]>([]);
  const [photosB, setPhotosB] = useState<File[]>([]);
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");
  const [layout, setLayout] = useState<SceneLayout>("sideBySide");
  // Optional composition reference (not saved in the draft). When chosen it takes priority over
  // `layout` in the prompt; the upload wins over a preset.
  const [compositionId, setCompositionId] = useState<string | null>(
    initialCompositionId ?? null
  );
  const [compositionFile, setCompositionFile] = useState<File | null>(null);
  const [modelState, setModelState] = useState<ModelState>({ phase: "idle" });
  const [purchasingPreview, setPurchasingPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  // Companion data for whichever taskId modelState is currently "polling" -- mirrors
  // PreviewPanel's pollContextRef for the same reason (see SavedDuoDraft above).
  const pollContextRef = useRef<{ taskId: string; referenceImageUrls: string[] } | null>(null);
  // Gates the save effect below so it can't race ahead and clear/overwrite a saved slice with
  // pre-restore defaults before the async IndexedDB load has actually run (see PreviewPanel's
  // identical hasRestored for the same reason).
  const [hasRestored, setHasRestored] = useState(false);

  const { user } = useAuth();
  const credits = useCredits();
  const hasCredits = (credits ?? 0) > 0;
  const { setValue, getValues } = useFormContext<OrderFormValues>();

  useEffect(() => {
    import("@google/model-viewer");
  }, []);
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Restore the whole in-progress duo build (both subjects' photos/names/layout, plus any
  // unconfirmed/still-polling generation) from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadDraftSlice<SavedDuoDraft>("duoDraft");
      if (cancelled) return;
      if (saved) {
        setPhotosA(saved.photosA);
        setPhotosB(saved.photosB);
        setSubjectA(saved.subjectA);
        setSubjectB(saved.subjectB);
        setLayout(saved.layout);
        if (saved.modelState.phase === "reviewingViews") {
          setModelState({
            phase: "reviewingViews",
            views: saved.modelState.views,
            referenceImageUrls: saved.modelState.referenceImageUrls,
            confirming: false,
            riskAssessment: saved.modelState.riskAssessment,
            riskAcknowledged: false,
          });
        } else if (saved.modelState.phase === "polling") {
          setModelState({ phase: "polling", progress: 0 });
          pollStatus(
            saved.modelState.taskId,
            saved.modelState.referenceImageUrls,
            saved.subjectA,
            saved.subjectB
          );
        }
      }
      setHasRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and keep it saved on every change (debounced) while restored.
  useEffect(() => {
    if (!hasRestored) return;
    let savedModelState: SavedDuoDraft["modelState"];
    if (modelState.phase === "reviewingViews") {
      savedModelState = {
        phase: "reviewingViews",
        views: modelState.views,
        referenceImageUrls: modelState.referenceImageUrls,
        riskAssessment: modelState.riskAssessment,
      };
    } else if (modelState.phase === "polling" && pollContextRef.current) {
      savedModelState = { phase: "polling", ...pollContextRef.current };
    } else {
      savedModelState = { phase: "idle" };
    }
    const timer = setTimeout(() => {
      saveDraftSlice<SavedDuoDraft>("duoDraft", {
        photosA,
        photosB,
        subjectA,
        subjectB,
        layout,
        modelState: savedModelState,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [hasRestored, photosA, photosB, subjectA, subjectB, layout, modelState]);

  const ready = photosA.length > 0 && photosB.length > 0 && subjectA.trim() && subjectB.trim();
  const currentModelUrl = modelState.phase === "success" ? modelState.modelUrl : undefined;

  // The two names are passed in (not read from state) because a poll restored after a page reload
  // starts from this render's still-empty state; the saved draft holds the real names.
  function pollStatus(taskId: string, referenceImageUrls: string[], nameA: string, nameB: string) {
    pollContextRef.current = { taskId, referenceImageUrls };
    let consecutiveFailures = 0;
    async function tick() {
      try {
        const res = await fetch(`/api/generate-model/${taskId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "ステータス取得に失敗しました");
        consecutiveFailures = 0;

        if (json.status === "success") {
          pollContextRef.current = null;
          setModelState({ phase: "success", modelUrl: json.modelUrl });
          setValue("subject", `${nameA.trim()} & ${nameB.trim()}`, { shouldValidate: true });
          setValue("subjectType", "pet");
          setValue("chainPositionNote", "");
          onGenerated({
            modelUrl: json.modelUrl,
            finishedPreviewUrls: {},
            referenceImageUrls,
          });
        } else if (json.status === "queued" || json.status === "running") {
          setModelState({ phase: "polling", progress: json.progress ?? 0 });
          pollTimerRef.current = setTimeout(tick, 4000);
        } else {
          pollContextRef.current = null;
          setModelState({ phase: "error", message: "モデル生成に失敗しました" });
        }
      } catch (err) {
        if (++consecutiveFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          pollTimerRef.current = setTimeout(tick, 4000);
          return;
        }
        pollContextRef.current = null;
        setModelState({
          phase: "error",
          message: err instanceof Error ? err.message : "ステータス取得に失敗しました",
        });
      }
    }
    pollTimerRef.current = setTimeout(tick, 4000);
  }

  async function handleGenerateClick() {
    if (!ready || !user) return;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    onGenerated(null);
    setModelState({ phase: "starting" });

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      photosA.forEach((file) => formData.append("photosA", file));
      photosB.forEach((file) => formData.append("photosB", file));
      formData.append("subjectA", subjectA);
      formData.append("subjectB", subjectB);
      formData.append("layout", layout);
      formData.append("subjectType", "pet");
      formData.append("checkHollowFill", String((colorQuantities.furCavity ?? 0) > 0));
      if (compositionFile) formData.append("compositionImage", compositionFile);
      else if (compositionId) formData.append("compositionId", compositionId);

      const res = await fetch("/api/generate-model-duo", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setModelState({
          phase: "error",
          message: json.error ?? "生成開始に失敗しました",
          freeGenerationLimitReached: json.freeGenerationLimitReached === true,
        });
        return;
      }

      setModelState({
        phase: "reviewingViews",
        views: json.views as Record<View, ImagePayload>,
        referenceImageUrls: (json.referenceImageUrls as string[]) ?? [],
        confirming: false,
        riskAssessment: (json.riskAssessment as ShapeRiskAssessment | null) ?? null,
        riskAcknowledged: false,
      });
    } catch (err) {
      setModelState({
        phase: "error",
        message: err instanceof Error ? err.message : "生成開始に失敗しました",
      });
    }
  }

  async function handleConfirmViews() {
    if (modelState.phase !== "reviewingViews" || !user) return;
    const { views, referenceImageUrls } = modelState;
    setModelState({ ...modelState, confirming: true });

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/generate-model/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ views }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成開始に失敗しました");

      setModelState({ phase: "polling", progress: 0 });
      // A duo item still spends one generation credit, same as a single-subject one -- tracked
      // the same way so the credit-usage discount (see calculateEstimate) applies here too.
      setValue("generationCreditsUsed", getValues("generationCreditsUsed") + 1);
      pollStatus(json.taskId as string, referenceImageUrls, subjectA, subjectB);
    } catch (err) {
      setModelState({
        phase: "error",
        message: err instanceof Error ? err.message : "生成開始に失敗しました",
      });
    }
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p>
          2匹を1つのキーホルダーにします。<b>1匹ずつ別の写真</b>をアップしてください（2匹が一緒に写った写真だと、混ざってしまうことがあります）。
        </p>
        <p className="mt-1">
          ステップ1：4方向のイメージ作り（1日2回まで無料）。ステップ2：イメージを確認してOKを押すと、3Dモデル作りに1クレジット（2匹分でも1回分）を使います。クレジットは1回100円で、アカウントごとに最初の1回は無料です。
        </p>
        <p className="mt-1">3匹以上をご希望の方は、メール（natsuki.ko006@gmail.com）でご相談ください。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">1匹目</p>
          <input
            type="text"
            value={subjectA}
            onChange={(e) => setSubjectA(e.target.value)}
            placeholder="お名前（必須）例：ポチ"
            aria-label="1匹目のお名前"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 sm:text-sm"
          />
          <PhotoUploader photos={photosA} onChange={setPhotosA} maxPhotos={3} />
        </div>
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">2匹目</p>
          <input
            type="text"
            value={subjectB}
            onChange={(e) => setSubjectB(e.target.value)}
            placeholder="お名前（必須）例：タマ"
            aria-label="2匹目のお名前"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 sm:text-sm"
          />
          <PhotoUploader photos={photosB} onChange={setPhotosB} maxPhotos={3} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">配置</legend>
        <div className="grid grid-cols-3 gap-2">
          {SCENE_LAYOUT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLayout(option)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-colors ${
                layout === option
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              <LayoutIcon layout={option} />
              <span className="text-xs font-medium text-slate-700">
                {SCENE_LAYOUT_LABELS[option]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <CompositionPicker
        presets={DUO_COMPOSITIONS}
        compositionId={compositionId}
        onCompositionIdChange={setCompositionId}
        compositionFile={compositionFile}
        onCompositionFileChange={setCompositionFile}
      />

      <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3 text-center">
        {modelState.phase === "success" && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="3Dモデルを拡大表示"
            className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        {modelState.phase === "idle" && (
          <p className="text-xs text-slate-400">
            {ready
              ? "「ステップ1」のボタンを押してください（30秒〜1分ほどかかります）"
              : `あとは${[
                  photosA.length === 0 && "1匹目の写真",
                  !subjectA.trim() && "1匹目のお名前",
                  photosB.length === 0 && "2匹目の写真",
                  !subjectB.trim() && "2匹目のお名前",
                ]
                  .filter(Boolean)
                  .join("、")}を入力すると生成できます`}
          </p>
        )}
        {(modelState.phase === "starting" || modelState.phase === "polling") && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-xs text-slate-500">
              {modelState.phase === "starting"
                ? "生成を開始しています..."
                : `形状を生成中... ${modelState.progress}%`}
            </p>
          </>
        )}
        {modelState.phase === "reviewingViews" && (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {VIEWS.map((view) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={view}
                src={`data:${modelState.views[view].mimeType};base64,${modelState.views[view].data}`}
                alt={VIEW_LABELS[view]}
                className="h-full w-full bg-white object-contain"
              />
            ))}
          </div>
        )}
        {modelState.phase === "success" && (
          <model-viewer
            ref={modelViewerRef}
            src={currentModelUrl}
            alt="生成された3Dモデルのプレビュー"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {modelState.phase === "error" && (
          <>
            <p className="text-xs text-red-600">{modelState.message}</p>
            {modelState.freeGenerationLimitReached && (
              <button
                type="button"
                onClick={handleBuyPreviewCredit}
                disabled={purchasingPreview}
                className="mt-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {purchasingPreview
                  ? "準備中..."
                  : `¥${PREVIEW_CREDIT_PRICE_YEN}で追加のプレビューを生成する`}
              </button>
            )}
          </>
        )}
      </div>

      {modelState.phase !== "reviewingViews" &&
        (user ? (
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={!ready || modelState.phase === "starting" || modelState.phase === "polling"}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {modelState.phase === "success" || modelState.phase === "error"
              ? "ステップ1をやり直す：4方向のイメージを作り直す"
              : "ステップ1：4方向のイメージを作る（1日2回まで無料）"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            ログインして生成する
          </button>
        ))}

      {modelState.phase === "reviewingViews" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">4方向の形状を確認してください</p>
          {(modelState.riskAssessment?.fragileRisk || modelState.riskAssessment?.hollowFillRisk) && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                この形状には注意点があります
              </p>
              {modelState.riskAssessment.fragileRisk && (
                <p className="mt-1 text-xs text-amber-700">
                  {modelState.riskAssessment.fragileReason || "細い部分が折れやすい可能性があります。"}
                </p>
              )}
              {modelState.riskAssessment.hollowFillRisk && (
                <p className="mt-1 text-xs text-amber-700">
                  {modelState.riskAssessment.hollowFillReason ||
                    "途中の細い部分より奥までレジンが届かない可能性があります。"}
                </p>
              )}
              <label className="mt-2 flex items-start gap-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={modelState.riskAcknowledged}
                  onChange={(e) =>
                    setModelState({ ...modelState, riskAcknowledged: e.target.checked })
                  }
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-700"
                />
                上記を理解し、破損・未充填のリスクがあってもこの形状で進めます
              </label>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={modelState.confirming}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              作り直す
            </button>
            <button
              type="button"
              onClick={handleConfirmViews}
              disabled={
                !hasCredits ||
                modelState.confirming ||
                ((modelState.riskAssessment?.fragileRisk || modelState.riskAssessment?.hollowFillRisk) &&
                  !modelState.riskAcknowledged)
              }
              className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {modelState.confirming ? "作成中..." : "ステップ2：この形でOK → 3Dモデルを作る（1クレジット）"}
            </button>
          </div>
          {user && !hasCredits && (
            <p className="mt-2 text-center text-xs text-amber-600">
              クレジットが足りません。3Dモデルを作るには、クレジットの購入が必要です（1回100円。アカウントごとに、最初の1回は無料です）。
            </p>
          )}
        </div>
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="閉じる"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {modelState.phase === "success" && (
              <model-viewer
                src={currentModelUrl}
                alt="生成された3Dモデルのプレビュー（拡大）"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
