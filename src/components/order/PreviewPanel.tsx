"use client";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Box,
  Download,
  Loader2,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { signInWithGoogle } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";
import {
  MAGIC_COLOR_OPTIONS,
  type ColorQuantities,
  type MagicColor,
  type OrderFormValues,
  type PetDetails,
  type Pose,
} from "@/types/order";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ImagePayload, View } from "@/lib/gemini";

// Mirrors gemini.ts's VIEWS/View — re-declared locally (not imported) so this client component
// never pulls in gemini.ts's server-only deps (@google/genai, sharp) into the browser bundle.
const VIEWS: View[] = ["front", "left", "back", "right"];
const VIEW_LABELS: Record<View, string> = {
  front: "正面",
  left: "左側面",
  back: "背面",
  right: "右側面",
};

type FinishedPreviewUrls = Partial<Record<MagicColor, string>>;

// Displaying the AI's (simulated) intermediate steps during generation measurably raises
// perceived value and wait tolerance versus a bare spinner, even though it doesn't change actual
// wait time -- the "labor illusion" effect (Buell & Norton 2011).
const MODEL_GENERATION_STATUS_MESSAGES = [
  "輪郭を解析中...",
  "被毛のテクスチャを解析中...",
  "3Dメッシュを構築中...",
  "細部の形状を最適化中...",
  "陰影と質感を計算中...",
];
const PREVIEW_GENERATION_STATUS_MESSAGES = [
  "色味を調整中...",
  "レジンの質感を計算中...",
  "光の反射を計算中...",
];
const STATUS_MESSAGE_INTERVAL_MS = 1800;

function useCyclingMessage(active: boolean, messages: string[]): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, STATUS_MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, messages]);
  return messages[active ? index : 0];
}

type GeneratedResult = {
  modelUrl: string;
  finishedPreviewUrls: FinishedPreviewUrls;
  referenceImageUrls: string[];
};

type PreviewPanelProps = {
  photos: File[];
  subject: string;
  pose: Pose;
  colorQuantities: ColorQuantities;
  petDetails: PetDetails;
  onGenerated: (result: GeneratedResult | null) => void;
};

function appendPetDetails(formData: FormData, petDetails: PetDetails) {
  if (petDetails.furColorNote) formData.append("furColorNote", petDetails.furColorNote);
  if (petDetails.breedNote) formData.append("breedNote", petDetails.breedNote);
  if (petDetails.accessoryNote) formData.append("accessoryNote", petDetails.accessoryNote);
  if (petDetails.bodyFeatureNote)
    formData.append("bodyFeatureNote", petDetails.bodyFeatureNote);
}

type GeneratedModel = {
  taskId: string;
  modelUrl: string;
  renderedImageUrl: string | null;
  finishedPreviewUrls: FinishedPreviewUrls;
  referenceImageUrls: string[];
  subject: string;
  pose: Pose;
};

type ColorPreviewState =
  | { phase: "idle" }
  | { phase: "generating" }
  | { phase: "success"; previewUrl: string }
  | { phase: "error"; message: string };

type ModelState =
  | { phase: "idle" }
  | { phase: "starting" }
  | {
      phase: "reviewingViews";
      views: Record<View, ImagePayload>;
      referenceImageUrls: string[];
      finishedPreviewUrls: FinishedPreviewUrls;
      confirming: boolean;
    }
  | { phase: "polling"; progress: number }
  | { phase: "success"; modelUrl: string }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 4000;

// Flat alpha blending just makes the model look like semi-see-through
// plastic, not real clear resin/crystal. Real transparency needs light to
// actually pass through and refract, which is what KHR_materials_transmission
// (+ ior/thickness/attenuation) simulates — model-viewer's scene-graph API
// exposes all of it, so use that instead of faking it with alpha.
const CLEAR_MATERIAL_IOR = 1.5; // typical for clear acrylic/resin
const CLEAR_MATERIAL_ROUGHNESS = 0.05; // glossy, not matte

// Original (non-clear) roughness/metallic per material, captured the first
// time we touch it, so toggling clear mode off restores the model's actual
// matte appearance instead of leaving it glossy.
const originalMaterialAppearance = new WeakMap<
  object,
  { roughness: number; metallic: number }
>();

function applyMaterialAppearance(
  modelViewer: ModelViewerElement,
  clear: boolean
) {
  const model = modelViewer.model;
  if (!model) return;

  const dimensions = modelViewer.getDimensions();
  const thickness =
    Math.max(dimensions.x, dimensions.y, dimensions.z) * 0.15 || 1;

  for (const material of model.materials) {
    if (!originalMaterialAppearance.has(material)) {
      originalMaterialAppearance.set(material, {
        roughness: material.pbrMetallicRoughness.roughnessFactor,
        metallic: material.pbrMetallicRoughness.metallicFactor,
      });
    }
    const original = originalMaterialAppearance.get(material)!;

    if (clear) {
      material.setTransmissionFactor(1);
      material.setIor(CLEAR_MATERIAL_IOR);
      material.setThicknessFactor(thickness);
      material.setAttenuationColor([1, 1, 1]);
      material.pbrMetallicRoughness.setRoughnessFactor(CLEAR_MATERIAL_ROUGHNESS);
      material.pbrMetallicRoughness.setMetallicFactor(0);
      material.setAlphaMode("OPAQUE");
      material.setDoubleSided(true);
    } else {
      material.setTransmissionFactor(0);
      material.pbrMetallicRoughness.setRoughnessFactor(original.roughness);
      material.pbrMetallicRoughness.setMetallicFactor(original.metallic);
      material.setAlphaMode("OPAQUE");
      material.setDoubleSided(false);
    }
  }
}

export function PreviewPanel({
  photos,
  subject,
  pose,
  colorQuantities,
  petDetails,
  onGenerated,
}: PreviewPanelProps) {
  const purchasedColors = MAGIC_COLOR_OPTIONS.filter(
    (color) => (colorQuantities[color] ?? 0) > 0
  );

  const [previewsByColor, setPreviewsByColor] = useState<
    Partial<Record<MagicColor, ColorPreviewState>>
  >({});
  const [activeColor, setActiveColor] = useState<MagicColor>(
    purchasedColors[0] ?? MAGIC_COLOR_OPTIONS[0]
  );
  const [modelState, setModelState] = useState<ModelState>({ phase: "idle" });
  const [gallery, setGallery] = useState<GeneratedModel[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isClearMaterial, setIsClearMaterial] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedView, setExpandedView] = useState<"model" | "preview" | null>(
    null
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const modalModelViewerRef = useRef<ModelViewerElement | null>(null);
  const suppressResetRef = useRef(false);

  const { user } = useAuth();
  const credits = useCredits();
  const hasCredits = (credits ?? 0) > 0;

  const { control, setValue, register } = useFormContext<OrderFormValues>();
  const [wantsHardware] = useWatch({
    control,
    name: ["wantsHardware"],
  });

  if (purchasedColors.length > 0 && !purchasedColors.includes(activeColor)) {
    setActiveColor(purchasedColors[0]);
  }

  const activePreview = previewsByColor[activeColor] ?? { phase: "idle" };
  const hasAnySuccessfulPreview = Object.values(previewsByColor).some(
    (p) => p?.phase === "success"
  );

  const modelGenerationStatus = useCyclingMessage(
    modelState.phase === "starting" || modelState.phase === "polling",
    MODEL_GENERATION_STATUS_MESSAGES
  );
  const previewGenerationStatus = useCyclingMessage(
    activePreview.phase === "generating",
    PREVIEW_GENERATION_STATUS_MESSAGES
  );

  const currentModelUrl =
    modelState.phase === "success" ? modelState.modelUrl : null;

  const displayModelUrl = currentModelUrl ?? undefined;

  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const [prevInputs, setPrevInputs] = useState({ photos, subject, pose });
  if (
    prevInputs.photos !== photos ||
    prevInputs.subject !== subject ||
    prevInputs.pose !== pose
  ) {
    setPrevInputs({ photos, subject, pose });
    if (suppressResetRef.current) {
      suppressResetRef.current = false;
    } else {
      setPreviewsByColor({});
      setModelState({ phase: "idle" });
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadGallery() {
      const snap = await getDocs(
        query(
          collection(db, "users", user!.uid, "models"),
          orderBy("createdAt", "asc")
        )
      );
      if (cancelled) return;
      const entries: GeneratedModel[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          taskId: d.id,
          modelUrl: data.modelUrl,
          renderedImageUrl: data.renderedImageUrl ?? null,
          finishedPreviewUrls: data.finishedPreviewUrls ?? {},
          referenceImageUrls: data.referenceImageUrls ?? [],
          subject: data.subject ?? "",
          pose: data.pose ?? "auto",
        };
      });
      setGallery(entries);
    }

    loadGallery();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!currentModelUrl) return;
    const elements = [modelViewerRef.current, modalModelViewerRef.current].filter(
      (el): el is ModelViewerElement => el !== null
    );
    if (elements.length === 0) return;

    function apply() {
      for (const el of elements) applyMaterialAppearance(el, isClearMaterial);
    }
    apply();
    for (const el of elements) el.addEventListener("load", apply);
    return () => {
      for (const el of elements) el.removeEventListener("load", apply);
    };
  }, [currentModelUrl, isClearMaterial, expandedView]);

  async function handleGeneratePreviewClick() {
    if (photos.length === 0 || !subject.trim() || !user) return;

    setPreviewsByColor((prev) => ({
      ...prev,
      [activeColor]: { phase: "generating" },
    }));
    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      photos.forEach((file) => formData.append("photos", file));
      formData.append("subject", subject);
      formData.append("pose", pose);
      formData.append("magicColor", activeColor);
      appendPetDetails(formData, petDetails);

      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成に失敗しました");

      setPreviewsByColor((prev) => ({
        ...prev,
        [activeColor]: { phase: "success", previewUrl: json.previewUrl },
      }));
    } catch (err) {
      setPreviewsByColor((prev) => ({
        ...prev,
        [activeColor]: {
          phase: "error",
          message: err instanceof Error ? err.message : "生成に失敗しました",
        },
      }));
    }
  }

  function pollStatus(
    taskId: string,
    finishedPreviewUrls: FinishedPreviewUrls,
    referenceImageUrls: string[]
  ) {
    async function tick() {
      try {
        const res = await fetch(`/api/generate-model/${taskId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "ステータス取得に失敗しました");

        if (json.status === "success") {
          const entry: GeneratedModel = {
            taskId,
            modelUrl: json.modelUrl,
            renderedImageUrl: json.renderedImageUrl ?? null,
            finishedPreviewUrls,
            referenceImageUrls,
            subject,
            pose,
          };
          setGallery((prev) => [...prev, entry]);
          setSelectedTaskId(taskId);
          setModelState({ phase: "success", modelUrl: entry.modelUrl });
          onGenerated({
            modelUrl: entry.modelUrl,
            finishedPreviewUrls,
            referenceImageUrls,
          });
          if (user) {
            setDoc(doc(db, "users", user.uid, "models", taskId), {
              modelUrl: entry.modelUrl,
              renderedImageUrl: entry.renderedImageUrl,
              finishedPreviewUrls,
              referenceImageUrls,
              subject,
              pose,
              createdAt: serverTimestamp(),
            }).catch(() => {});
          }
        } else if (json.status === "queued" || json.status === "running") {
          setModelState({ phase: "polling", progress: json.progress ?? 0 });
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        } else {
          setModelState({ phase: "error", message: "モデル生成に失敗しました" });
        }
      } catch (err) {
        setModelState({
          phase: "error",
          message:
            err instanceof Error ? err.message : "ステータス取得に失敗しました",
        });
      }
    }

    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
  }

  async function handleGenerateModelClick() {
    if (
      !hasAnySuccessfulPreview ||
      photos.length === 0 ||
      !subject.trim() ||
      !user ||
      !hasCredits
    ) {
      return;
    }

    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    onGenerated(null);
    setValue("chainPositionNote", "");
    const finishedPreviewUrls: FinishedPreviewUrls = Object.fromEntries(
      Object.entries(previewsByColor)
        .filter(([, state]) => state?.phase === "success")
        .map(([color, state]) => [
          color,
          (state as { phase: "success"; previewUrl: string }).previewUrl,
        ])
    );
    setModelState({ phase: "starting" });

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      photos.forEach((file) => formData.append("photos", file));
      formData.append("subject", subject);
      formData.append("pose", pose);
      appendPetDetails(formData, petDetails);

      const res = await fetch("/api/generate-model", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成開始に失敗しました");

      setModelState({
        phase: "reviewingViews",
        views: json.views as Record<View, ImagePayload>,
        referenceImageUrls: (json.referenceImageUrls as string[]) ?? [],
        finishedPreviewUrls,
        confirming: false,
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
    const { views, referenceImageUrls, finishedPreviewUrls } = modelState;
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
      pollStatus(json.taskId as string, finishedPreviewUrls, referenceImageUrls);
    } catch (err) {
      setModelState({
        phase: "error",
        message: err instanceof Error ? err.message : "生成開始に失敗しました",
      });
    }
  }

  async function handleDownload() {
    if (modelState.phase !== "success" || isDownloading) return;
    setIsDownloading(true);
    try {
      const res = await fetch(modelState.modelUrl);
      if (!res.ok) throw new Error("ダウンロードに失敗しました");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `figure-${selectedTaskId ?? "model"}.glb`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore; the model remains viewable even if the download attempt fails
    } finally {
      setIsDownloading(false);
    }
  }

  function handleSelectGalleryItem(entry: GeneratedModel) {
    if (entry.taskId === selectedTaskId) return;
    setValue("chainPositionNote", "");
    suppressResetRef.current = true;
    setValue("subject", entry.subject, { shouldValidate: true });
    setValue("pose", entry.pose, { shouldValidate: true });
    setSelectedTaskId(entry.taskId);
    setModelState({ phase: "success", modelUrl: entry.modelUrl });
    const restored: Partial<Record<MagicColor, ColorPreviewState>> = {};
    for (const [color, url] of Object.entries(entry.finishedPreviewUrls)) {
      if (url) {
        restored[color as MagicColor] = { phase: "success", previewUrl: url };
      }
    }
    setPreviewsByColor(restored);
    const firstColor = Object.keys(restored)[0] as MagicColor | undefined;
    if (firstColor) setActiveColor(firstColor);
    onGenerated({
      modelUrl: entry.modelUrl,
      finishedPreviewUrls: entry.finishedPreviewUrls,
      referenceImageUrls: entry.referenceImageUrls,
    });
  }

  function closeExpandedView() {
    setExpandedView(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3 text-center">
          {modelState.phase === "success" && (
            <button
              type="button"
              onClick={() => setExpandedView("model")}
              aria-label="3Dモデルを拡大表示"
              className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {modelState.phase === "idle" && (
            <>
              <Box className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
              <p className="text-xs text-slate-400">3D形状プレビュー</p>
            </>
          )}
          {(modelState.phase === "starting" || modelState.phase === "polling") && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-xs text-slate-500">
                {modelState.phase === "starting"
                  ? "生成を開始しています..."
                  : `形状を生成中... ${modelState.progress}%`}
              </p>
              <p className="text-[10px] text-slate-400">{modelGenerationStatus}</p>
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
                  className="h-full w-full object-cover"
                />
              ))}
            </div>
          )}
          {modelState.phase === "success" && (
            <model-viewer
              ref={modelViewerRef}
              src={displayModelUrl}
              alt="生成された3Dモデルのプレビュー"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              style={{ width: "100%", height: "100%" }}
            />
          )}
          {modelState.phase === "error" && (
            <p className="text-xs text-red-600">{modelState.message}</p>
          )}
        </div>

        <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3 text-center">
          {activePreview.phase === "success" && (
            <button
              type="button"
              onClick={() => setExpandedView("preview")}
              aria-label="完成イメージを拡大表示"
              className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {activePreview.phase === "idle" && (
            <>
              <Sparkles className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
              <p className="text-xs text-slate-400">完成イメージ（未生成）</p>
            </>
          )}
          {activePreview.phase === "generating" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="text-xs text-slate-500">生成中...</p>
              <p className="text-[10px] text-slate-400">{previewGenerationStatus}</p>
            </>
          )}
          {activePreview.phase === "success" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activePreview.previewUrl}
              alt="魔法の素材での完成イメージ"
              className="h-full w-full object-cover"
            />
          )}
          {activePreview.phase === "error" && (
            <p className="text-xs text-red-600">{activePreview.message}</p>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">
        左：3D形状（白マット） / 右：選択中カラーの完成イメージ
      </p>

      {purchasedColors.length > 1 && (
        <div className="flex justify-center gap-2">
          {purchasedColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setActiveColor(color)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                color === activeColor
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {MAGIC_COLOR_LABELS[color]}
              {previewsByColor[color]?.phase === "success" && " ✓"}
            </button>
          ))}
        </div>
      )}

      {user ? (
        <button
          type="button"
          onClick={handleGeneratePreviewClick}
          disabled={
            photos.length === 0 ||
            !subject.trim() ||
            activePreview.phase === "generating"
          }
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activePreview.phase === "success" || activePreview.phase === "error"
            ? `${MAGIC_COLOR_LABELS[activeColor]}の完成イメージを作り直す（無料）`
            : `${MAGIC_COLOR_LABELS[activeColor]}の完成イメージを生成する（無料）`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          ログインして完成イメージを生成する
        </button>
      )}

      {hasAnySuccessfulPreview && modelState.phase !== "reviewingViews" && (
        <button
          type="button"
          onClick={handleGenerateModelClick}
          disabled={
            !hasCredits ||
            modelState.phase === "starting" ||
            modelState.phase === "polling"
          }
          className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {modelState.phase === "success" || modelState.phase === "error"
            ? "この形状でもう一度3D化する（1クレジット）"
            : "この形状を3D化する（1クレジット）"}
        </button>
      )}

      {modelState.phase === "reviewingViews" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">
            4方向の形状を確認してください
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {VIEWS.map((view) => (
              <div key={view} className="space-y-1">
                <div className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${modelState.views[view].mimeType};base64,${modelState.views[view].data}`}
                    alt={VIEW_LABELS[view]}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500">
                  {VIEW_LABELS[view]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleGenerateModelClick}
              disabled={!hasCredits || modelState.confirming}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              作り直す（1クレジット）
            </button>
            <button
              type="button"
              onClick={handleConfirmViews}
              disabled={modelState.confirming}
              className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {modelState.confirming ? "作成中..." : "この形状でOK・3Dモデルを作成"}
            </button>
          </div>
        </div>
      )}

      {modelState.phase === "success" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsClearMaterial((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isClearMaterial
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            クリア素材風に表示
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isDownloading ? "ダウンロード中..." : "モデルをダウンロード"}
          </button>
        </div>
      )}

      {modelState.phase === "success" && wantsHardware && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label
            htmlFor="chainPositionNote"
            className="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            上の穴（金具用）を開けたい位置（任意）
          </label>
          <textarea
            id="chainPositionNote"
            rows={2}
            {...register("chainPositionNote")}
            placeholder="例：頭の上／背中の中央　※未記入の場合はおまかせで判断します"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            ※実際の穴あけは製作時に手作業で行います。ご希望に近い位置で仕上げますが、形状によっては多少ずれる場合がございます。
          </p>
        </div>
      )}

      {gallery.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gallery.map((entry) => (
            <button
              key={entry.taskId}
              type="button"
              onClick={() => handleSelectGalleryItem(entry)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${
                entry.taskId === selectedTaskId
                  ? "border-slate-800"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              {entry.renderedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.renderedImageUrl}
                  alt="生成済みモデル"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Box className="m-auto h-6 w-6 text-slate-300" />
              )}
            </button>
          ))}
        </div>
      )}

      {modelState.phase !== "success" && photos.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          先に写真をアップロードしてください（過去に生成したモデルはギャラリーから選べます）
        </p>
      )}
      {modelState.phase !== "success" && photos.length > 0 && !subject.trim() && (
        <p className="text-center text-xs text-slate-400">
          「何を作りますか？」を入力してください
        </p>
      )}
      {user && hasAnySuccessfulPreview && !hasCredits && (
        <p className="text-center text-xs text-amber-600">
          クレジットが不足しています。購入してからお試しください。
        </p>
      )}

      {expandedView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeExpandedView}
        >
          <button
            type="button"
            onClick={closeExpandedView}
            aria-label="閉じる"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedView === "model" && modelState.phase === "success" && (
              <model-viewer
                ref={modalModelViewerRef}
                src={displayModelUrl}
                alt="生成された3Dモデルのプレビュー（拡大）"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            )}
            {expandedView === "preview" && activePreview.phase === "success" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePreview.previewUrl}
                alt="魔法の素材での完成イメージ（拡大）"
                className="h-full w-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
