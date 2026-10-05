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
  AlertTriangle,
  Box,
  Download,
  Loader2,
  Maximize2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { signInWithGoogle } from "@/lib/auth";
import { PREVIEW_CREDIT_PRICE_YEN } from "@/lib/creditPacks";
import { CompositionPicker } from "@/components/order/CompositionPicker";
import { SINGLE_COMPOSITIONS } from "@/lib/compositions";
import { clearDraftSlice,loadDraftSlice, saveDraftSlice } from "@/lib/draftStorage";
import { db } from "@/lib/firebase";
import { uploadCustomModel } from "@/lib/orders";
import { CHARO_PREMADE_MODEL } from "@/lib/premadeModels";
import { MAX_CONSECUTIVE_POLL_FAILURES } from "@/lib/generationPolling";
import {
  MAX_CUSTOM_MODEL_SIZE_BYTES,
  type ColorQuantities,
  type MagicColor,
  type ModelStyle,
  type OrderFormValues,
  type PetDetails,
  type Pose,
  type SubjectType,
} from "@/types/order";
import type { ModelViewerElement } from "@google/model-viewer";
import type { ImagePayload, ShapeRiskAssessment, View } from "@/lib/gemini";

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
  isCustomModel?: boolean;
  // True when this result comes from picking an already-existing model (Charo, or a past
  // generation) rather than a brand-new AI generation -- no credit was spent, so the caller
  // shouldn't count it toward the credit-usage discount.
  isReselect?: boolean;
};

type PreviewPanelProps = {
  mode: "ai" | "custom" | "reuse";
  photos: File[];
  subject: string;
  subjectType: SubjectType;
  pose: Pose;
  modelStyle: ModelStyle;
  wantsSelfStanding: boolean;
  colorQuantities: ColorQuantities;
  petDetails: PetDetails;
  onGenerated: (result: GeneratedResult | null) => void;
  // Set only in "reuse" mode -- a specific past model to hydrate to instead of the default
  // (Charo). Left null/omitted in normal use; PreviewPanel's own gallery already covers picking
  // a different one after mount (see handleSelectGalleryItem).
  initialModel?: GeneratedModel | null;
};

function appendPetDetails(formData: FormData, petDetails: PetDetails) {
  if (petDetails.furColorNote) formData.append("furColorNote", petDetails.furColorNote);
  if (petDetails.breedNote) formData.append("breedNote", petDetails.breedNote);
  if (petDetails.accessoryNote) formData.append("accessoryNote", petDetails.accessoryNote);
  if (petDetails.bodyFeatureNote)
    formData.append("bodyFeatureNote", petDetails.bodyFeatureNote);
}

export type GeneratedModel = {
  taskId: string;
  modelUrl: string;
  renderedImageUrl: string | null;
  finishedPreviewUrls: FinishedPreviewUrls;
  referenceImageUrls: string[];
  subject: string;
  pose: Pose;
};

type ModelState =
  | { phase: "idle" }
  | { phase: "starting" }
  | {
      phase: "reviewingViews";
      views: Record<View, ImagePayload>;
      referenceImageUrls: string[];
      finishedPreviewUrls: FinishedPreviewUrls;
      confirming: boolean;
      riskAssessment: ShapeRiskAssessment | null;
      riskAcknowledged: boolean;
    }
  | { phase: "polling"; progress: number }
  | { phase: "success"; modelUrl: string }
  | { phase: "error"; message: string; freeGenerationLimitReached?: boolean };

const POLL_INTERVAL_MS = 4000;

// What IndexedDB persistence (src/lib/draftStorage.ts) needs to fully restore an in-progress
// generation across a page reload -- ModelState's own "polling" variant only carries `progress`
// (see pollStatus's closure), so the taskId/URLs it needs to resume have to be tracked alongside
// it separately (see pollContextRef below).
type SavedPreviewDraft =
  | {
      phase: "reviewingViews";
      views: Record<View, ImagePayload>;
      referenceImageUrls: string[];
      finishedPreviewUrls: FinishedPreviewUrls;
      riskAssessment: ShapeRiskAssessment | null;
    }
  | {
      phase: "polling";
      taskId: string;
      finishedPreviewUrls: FinishedPreviewUrls;
      referenceImageUrls: string[];
    };

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
    // Wrapped per-material: a customer-uploaded model (see "自分の3Dモデルを持ち込む") can carry
    // material setups the AI-generated pipeline never produces -- e.g. KHR_materials_unlit, or a
    // pbrMetallicRoughness channel missing entirely -- and model-viewer's scene-graph setters
    // throw in those cases. One incompatible material shouldn't crash the whole toggle (and
    // everyone else's 3D preview with it); best-effort the rest and move on.
    try {
      if (!material.pbrMetallicRoughness) continue;

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
    } catch (err) {
      console.warn("clear-material appearance failed for one material, skipping it", err);
    }
  }
}

export function PreviewPanel({
  mode,
  photos,
  subject,
  subjectType,
  pose,
  modelStyle,
  wantsSelfStanding,
  colorQuantities,
  petDetails,
  onGenerated,
  initialModel,
}: PreviewPanelProps) {
  // In "reuse" mode, falling back to the premade Charo mascot when no specific past model was
  // passed in means this panel always opens with SOMETHING selected -- no empty/idle state to
  // click through first, matching the "最初はちゃろが選択済み" default from the product-page
  // redesign.
  const effectiveInitialModel = mode === "reuse" ? (initialModel ?? CHARO_PREMADE_MODEL) : null;

  const [modelState, setModelState] = useState<ModelState>(() =>
    effectiveInitialModel
      ? { phase: "success", modelUrl: effectiveInitialModel.modelUrl }
      : { phase: "idle" }
  );
  const [customUpload, setCustomUpload] = useState<
    { phase: "idle" } | { phase: "uploading" } | { phase: "error"; message: string }
  >({ phase: "idle" });
  // Optional composition reference (not saved in the draft: it just resets on reload).
  const [compositionId, setCompositionId] = useState<string | null>(null);
  const [compositionFile, setCompositionFile] = useState<File | null>(null);
  const [gallery, setGallery] = useState<GeneratedModel[]>(
    mode === "reuse" ? [CHARO_PREMADE_MODEL] : []
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    effectiveInitialModel?.taskId ?? null
  );
  // Tripo's renderedImageUrl is a signed, expiring URL -- an old past model's thumbnail can
  // start failing to load once it expires (the modelUrl itself is fine; it's re-hosted
  // permanently, see /api/generate-model/[taskId]). Tracks which ones have failed so the gallery
  // falls back to the plain icon instead of showing a broken-image glyph.
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
  const [isClearMaterial, setIsClearMaterial] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedView, setExpandedView] = useState<"model" | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const modalModelViewerRef = useRef<ModelViewerElement | null>(null);
  const suppressResetRef = useRef(false);
  // Companion data for whichever taskId modelState is currently "polling" -- see
  // SavedPreviewDraft above for why this can't just live inside ModelState itself.
  const pollContextRef = useRef<{
    taskId: string;
    finishedPreviewUrls: FinishedPreviewUrls;
    referenceImageUrls: string[];
  } | null>(null);

  const { user } = useAuth();
  const credits = useCredits();
  const hasCredits = (credits ?? 0) > 0;

  const { control, setValue, register } = useFormContext<OrderFormValues>();
  const [wantsHardware] = useWatch({
    control,
    name: ["wantsHardware"],
  });

  const modelGenerationStatus = useCyclingMessage(
    modelState.phase === "starting" || modelState.phase === "polling",
    MODEL_GENERATION_STATUS_MESSAGES
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

  // Reports the default-hydrated model (Charo, or an explicit initialModel) up to the parent
  // once on mount -- otherwise the parent's own generatedModelUrl/etc state (used to enable
  // "カートに追加") would stay empty even though this panel is already showing a selected model.
  // Runs once per mount only, matching this component's key-based remount-per-draft pattern.
  useEffect(() => {
    if (effectiveInitialModel) {
      setValue("subject", effectiveInitialModel.subject, { shouldValidate: true });
      setValue("pose", effectiveInitialModel.pose);
      onGenerated({
        modelUrl: effectiveInitialModel.modelUrl,
        finishedPreviewUrls: effectiveInitialModel.finishedPreviewUrls,
        referenceImageUrls: effectiveInitialModel.referenceImageUrls,
        isReselect: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore an in-progress (unconfirmed reviewingViews, or still-polling) generation from
  // IndexedDB on mount -- "reuse" mode never enters either phase (its gallery picks an
  // already-hosted model directly), so it has nothing worth persisting here. hasRestored gates
  // the save effect below so it can't race ahead and clear/overwrite the saved slice with the
  // pre-restore "idle" default before this async load has actually run.
  const [hasRestored, setHasRestored] = useState(mode === "reuse");
  useEffect(() => {
    if (mode === "reuse") return;
    let cancelled = false;
    (async () => {
      const saved = await loadDraftSlice<SavedPreviewDraft>("previewDraft");
      if (cancelled) return;
      if (saved?.phase === "reviewingViews") {
        setModelState({
          phase: "reviewingViews",
          views: saved.views,
          referenceImageUrls: saved.referenceImageUrls,
          finishedPreviewUrls: saved.finishedPreviewUrls,
          confirming: false,
          riskAssessment: saved.riskAssessment,
          riskAcknowledged: false,
        });
      } else if (saved?.phase === "polling") {
        setModelState({ phase: "polling", progress: 0 });
        pollStatus(saved.taskId, saved.finishedPreviewUrls, saved.referenceImageUrls);
      }
      setHasRestored(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and keep it saved while there's still something to resume; clear it once the generation
  // reaches a terminal (success/error) or not-yet-started state, so a stale entry never gets
  // restored into an unrelated later draft.
  useEffect(() => {
    if (mode === "reuse" || !hasRestored) return;
    if (modelState.phase === "reviewingViews") {
      saveDraftSlice<SavedPreviewDraft>("previewDraft", {
        phase: "reviewingViews",
        views: modelState.views,
        referenceImageUrls: modelState.referenceImageUrls,
        finishedPreviewUrls: modelState.finishedPreviewUrls,
        riskAssessment: modelState.riskAssessment,
      });
    } else if (modelState.phase === "polling" && pollContextRef.current) {
      saveDraftSlice<SavedPreviewDraft>("previewDraft", {
        phase: "polling",
        ...pollContextRef.current,
      });
    } else if (modelState.phase !== "starting") {
      clearDraftSlice("previewDraft");
    }
  }, [mode, modelState, hasRestored]);

  const [prevInputs, setPrevInputs] = useState({ photos, subject, subjectType, pose });
  if (
    // In "reuse" mode there's no regeneration tied to these fields (no photos, model already
    // made) -- editing the subject label or pose afterward is purely cosmetic and shouldn't
    // wipe out the hydrated model/preview state.
    mode !== "reuse" &&
    (prevInputs.photos !== photos ||
      prevInputs.subject !== subject ||
      prevInputs.subjectType !== subjectType ||
      prevInputs.pose !== pose)
  ) {
    setPrevInputs({ photos, subject, subjectType, pose });
    if (suppressResetRef.current) {
      suppressResetRef.current = false;
    } else {
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
      // Charo stays pinned first regardless of mode -- in "ai"/"custom" mode this row is the
      // customer's own generation history only (see the mode checks below it never renders
      // there), so the extra entry is harmless; in "reuse" mode it keeps the mascot alongside
      // the customer's own past models in one switchable list.
      setGallery(mode === "reuse" ? [CHARO_PREMADE_MODEL, ...entries] : entries);
    }

    loadGallery();
    return () => {
      cancelled = true;
    };
  }, [user, mode]);

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

  function pollStatus(
    taskId: string,
    finishedPreviewUrls: FinishedPreviewUrls,
    referenceImageUrls: string[]
  ) {
    pollContextRef.current = { taskId, finishedPreviewUrls, referenceImageUrls };
    let consecutiveFailures = 0;
    async function tick() {
      try {
        const res = await fetch(`/api/generate-model/${taskId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "ステータス取得に失敗しました");
        consecutiveFailures = 0;

        if (json.status === "success") {
          pollContextRef.current = null;
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
          pollContextRef.current = null;
          setModelState({ phase: "error", message: "モデル生成に失敗しました" });
        }
      } catch (err) {
        if (++consecutiveFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        pollContextRef.current = null;
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
      photos.length === 0 ||
      !subject.trim() ||
      !user
    ) {
      return;
    }

    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    onGenerated(null);
    setValue("chainPositionNote", "");
    const finishedPreviewUrls: FinishedPreviewUrls = {};
    setModelState({ phase: "starting" });

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      photos.forEach((file) => formData.append("photos", file));
      formData.append("subject", subject);
      formData.append("subjectType", subjectType);
      formData.append("pose", pose);
      formData.append("modelStyle", modelStyle);
      formData.append("wantsSelfStanding", String(wantsSelfStanding));
      formData.append("checkHollowFill", String((colorQuantities.furCavity ?? 0) > 0));
      appendPetDetails(formData, petDetails);
      if (compositionFile) formData.append("compositionImage", compositionFile);
      else if (compositionId) formData.append("compositionId", compositionId);

      const res = await fetch("/api/generate-model", {
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
        finishedPreviewUrls,
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

  const [purchasingPreview, setPurchasingPreview] = useState(false);
  async function handleBuyPreviewCredit() {
    if (!user || purchasingPreview) return;
    setPurchasingPreview(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "preview" }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "決済ページの作成に失敗しました");
      window.location.assign(json.url as string);
    } catch (err) {
      console.error("preview credit purchase failed", err);
      setPurchasingPreview(false);
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

  // The AI-vs-custom-model choice is now made a step earlier (see OrderForm's mode-selection
  // step) and passed in as a prop; this just clears out any in-progress generation/upload state
  // when the customer goes back and switches their choice for the item they're building. Same
  // derived-state-during-render pattern as the prevInputs check below, for the same reason.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setModelState({ phase: "idle" });
    setCustomUpload({ phase: "idle" });
    setValue("chainPositionNote", "");
    onGenerated(null);
  }

  async function handleCustomModelFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setCustomUpload({
        phase: "error",
        message: "GLB形式（.glb）の3Dモデルファイルを選択してください",
      });
      return;
    }
    if (file.size > MAX_CUSTOM_MODEL_SIZE_BYTES) {
      setCustomUpload({
        phase: "error",
        message: `ファイルサイズは${Math.floor(
          MAX_CUSTOM_MODEL_SIZE_BYTES / (1024 * 1024)
        )}MB以下にしてください`,
      });
      return;
    }

    setCustomUpload({ phase: "uploading" });
    try {
      const modelUrl = await uploadCustomModel(file);
      setCustomUpload({ phase: "idle" });
      setModelState({ phase: "success", modelUrl });
      setValue("chainPositionNote", "");
      onGenerated({
        modelUrl,
        finishedPreviewUrls: {},
        referenceImageUrls: [],
        isCustomModel: true,
      });
    } catch (err) {
      setCustomUpload({
        phase: "error",
        message: err instanceof Error ? err.message : "アップロードに失敗しました",
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
    onGenerated({
      modelUrl: entry.modelUrl,
      finishedPreviewUrls: entry.finishedPreviewUrls,
      referenceImageUrls: entry.referenceImageUrls,
      isReselect: true,
    });
  }

  function closeExpandedView() {
    setExpandedView(null);
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-sm">
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
              <p className="text-xs text-slate-400">ここに結果が表示されます</p>
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
                  className="h-full w-full bg-white object-contain"
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

      </div>

      {mode === "custom" && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-4 text-center hover:border-slate-400">
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-xs font-medium text-slate-700">
              {customUpload.phase === "uploading"
                ? "アップロード中..."
                : "3Dモデルファイル（.glb）を選択"}
            </span>
            <span className="text-[10px] text-slate-400">
              GLB形式、{Math.floor(MAX_CUSTOM_MODEL_SIZE_BYTES / (1024 * 1024))}MBまで
            </span>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              disabled={customUpload.phase === "uploading"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleCustomModelFile(file);
              }}
            />
          </label>
          {customUpload.phase === "error" && (
            <p className="text-xs text-red-600">{customUpload.message}</p>
          )}
          {modelState.phase === "success" && customUpload.phase === "idle" && (
            <p className="text-xs text-emerald-600">
              ✓ アップロード済み。サイズはご指定のサイズに合わせて調整されます。
            </p>
          )}
          <p className="text-[10px] text-slate-400">
            寸法・強度・厚みなどの造形上の理由で、お預かりしたモデルをそのまま製作できない場合があります。あらかじめご了承ください。
          </p>
        </div>
      )}

      {mode === "ai" && modelState.phase !== "reviewingViews" && (
        <CompositionPicker
          presets={SINGLE_COMPOSITIONS}
          compositionId={compositionId}
          onCompositionIdChange={setCompositionId}
          compositionFile={compositionFile}
          onCompositionFileChange={setCompositionFile}
        />
      )}

      {mode === "ai" &&
        modelState.phase !== "reviewingViews" &&
        (user ? (
          <button
            type="button"
            onClick={handleGenerateModelClick}
            disabled={
              photos.length === 0 ||
              !subject.trim() ||
              modelState.phase === "starting" ||
              modelState.phase === "polling"
            }
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {modelState.phase === "success" || modelState.phase === "error"
              ? "ステップ1をやり直す：4方向のイメージを作り直す"
              : "ステップ1：写真から4方向のイメージを作る（1日2回まで無料）"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            ログインして、ステップ1（4方向のイメージ作り）を始める
          </button>
        ))}

      {mode === "ai" && modelState.phase === "reviewingViews" && (
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
                    className="h-full w-full bg-white object-contain"
                  />
                </div>
                <p className="text-center text-[10px] text-slate-500">
                  {VIEW_LABELS[view]}
                </p>
              </div>
            ))}
          </div>
          {(modelState.riskAssessment?.fragileRisk || modelState.riskAssessment?.hollowFillRisk) && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
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
              onClick={handleGenerateModelClick}
              disabled={modelState.confirming}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              イメージを作り直す
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

      {(mode === "ai" || mode === "reuse") && gallery.length > 1 && (
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
              {entry.renderedImageUrl && !failedThumbnails.has(entry.taskId) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.renderedImageUrl}
                  alt="生成済みモデル"
                  className="h-full w-full object-cover"
                  onError={() =>
                    setFailedThumbnails((prev) => new Set(prev).add(entry.taskId))
                  }
                />
              ) : (
                <Box className="m-auto h-6 w-6 text-slate-300" />
              )}
            </button>
          ))}
        </div>
      )}

      {mode === "ai" && modelState.phase !== "success" && photos.length === 0 && (
        <p className="text-center text-xs text-slate-400">
          先に写真をアップロードしてください（過去に生成したモデルはギャラリーから選べます）
        </p>
      )}
      {mode === "ai" && modelState.phase !== "success" && photos.length > 0 && !subject.trim() && (
        <p className="text-center text-xs text-slate-400">
          「お名前」または「何を作りますか？」の欄を入力してください
        </p>
      )}
      {mode === "ai" && user && modelState.phase === "reviewingViews" && !hasCredits && (
        <p className="text-center text-xs text-amber-600">
          クレジットが足りません。3Dモデルを作るには、クレジットの購入が必要です（1回100円。アカウントごとに、最初の1回は無料です）。4方向のイメージ作りは、1日2回まで無料です。
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
            {modelState.phase === "success" && (
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
          </div>
        </div>
      )}
    </div>
  );
}
