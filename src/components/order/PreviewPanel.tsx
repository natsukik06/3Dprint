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
import { Box, Download, Loader2, MapPin, Maximize2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { signInWithGoogle } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { injectHoleMarkers, type MarkerSpec } from "@/lib/glbMarker";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";
import {
  DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
  MAGIC_COLOR_OPTIONS,
  MAX_BOTTOM_HOLE_DIAMETER_MM,
  MIN_BOTTOM_HOLE_DIAMETER_MM,
  type ColorQuantities,
  type MagicColor,
  type OrderFormValues,
  type Pose,
} from "@/types/order";
import type { ModelViewerElement } from "@google/model-viewer";

type FinishedPreviewUrls = Partial<Record<MagicColor, string>>;

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
  onGenerated: (result: GeneratedResult | null) => void;
};

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
  | { phase: "polling"; progress: number }
  | { phase: "success"; modelUrl: string }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 4000;

// Visual-only indicator pegs (not the real hole diameter) showing where and
// in which direction a hole will actually be drilled, rendered as real 3D
// geometry injected into the previewed GLB so occlusion/lighting look right.
const HOLE_MARKER_DIAMETER_MM = 0.8;
const HOLE_MARKER_HEIGHT_MM = 8;
const TOP_HOLE_MARKER_COLOR: [number, number, number] = [0.937, 0.267, 0.267]; // red-500
const BOTTOM_HOLE_MARKER_COLOR: [number, number, number] = [0.961, 0.62, 0.043]; // amber-500

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
  const [placingHoleTarget, setPlacingHoleTarget] = useState<
    "top" | "bottom" | null
  >(null);
  const [expandedView, setExpandedView] = useState<"model" | "preview" | null>(
    null
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelViewerRef = useRef<ModelViewerElement | null>(null);
  const modalModelViewerRef = useRef<ModelViewerElement | null>(null);
  const suppressResetRef = useRef(false);
  const pointerDownInfoRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const modelBufferCacheRef = useRef<{ url: string; buffer: ArrayBuffer } | null>(
    null
  );
  const markerBlobUrlRef = useRef<string | null>(null);
  const [markerModelUrl, setMarkerModelUrl] = useState<string | null>(null);

  const { user } = useAuth();
  const credits = useCredits();
  const hasCredits = (credits ?? 0) > 0;

  const { control, setValue } = useFormContext<OrderFormValues>();
  const [wantsHardware, holePosition, bottomHolePosition, bottomHoleDiameterMm] =
    useWatch({
      control,
      name: [
        "wantsHardware",
        "holePosition",
        "bottomHolePosition",
        "bottomHoleDiameterMm",
      ],
    });

  if (purchasedColors.length > 0 && !purchasedColors.includes(activeColor)) {
    setActiveColor(purchasedColors[0]);
  }

  const activePreview = previewsByColor[activeColor] ?? { phase: "idle" };
  const hasAnySuccessfulPreview = Object.values(previewsByColor).some(
    (p) => p?.phase === "success"
  );

  const currentModelUrl =
    modelState.phase === "success" ? modelState.modelUrl : null;

  // Renders the placed hole(s) as real 3D marker geometry (position + actual
  // drill direction) injected into a copy of the GLB, so the preview shows
  // correctly-occluded/lit pegs instead of a flat camera-facing dot.
  useEffect(() => {
    let cancelled = false;

    async function rebuild() {
      const markers: MarkerSpec[] = [];
      if (holePosition) {
        markers.push({
          position: [holePosition.x, holePosition.y, holePosition.z],
          direction:
            typeof holePosition.nx === "number" &&
            typeof holePosition.ny === "number" &&
            typeof holePosition.nz === "number"
              ? [holePosition.nx, holePosition.ny, holePosition.nz]
              : [0, 1, 0],
          diameterMm: HOLE_MARKER_DIAMETER_MM,
          heightMm: HOLE_MARKER_HEIGHT_MM,
          colorRgb: TOP_HOLE_MARKER_COLOR,
        });
      }
      if (bottomHolePosition) {
        markers.push({
          position: [bottomHolePosition.x, bottomHolePosition.y, bottomHolePosition.z],
          direction:
            typeof bottomHolePosition.nx === "number" &&
            typeof bottomHolePosition.ny === "number" &&
            typeof bottomHolePosition.nz === "number"
              ? [bottomHolePosition.nx, bottomHolePosition.ny, bottomHolePosition.nz]
              : [0, -1, 0],
          diameterMm: HOLE_MARKER_DIAMETER_MM,
          heightMm: HOLE_MARKER_HEIGHT_MM,
          colorRgb: BOTTOM_HOLE_MARKER_COLOR,
        });
      }

      if (!currentModelUrl || markers.length === 0) {
        if (markerBlobUrlRef.current) {
          URL.revokeObjectURL(markerBlobUrlRef.current);
          markerBlobUrlRef.current = null;
        }
        setMarkerModelUrl(null);
        return;
      }

      try {
        let cached = modelBufferCacheRef.current;
        if (!cached || cached.url !== currentModelUrl) {
          const res = await fetch(currentModelUrl);
          if (!res.ok) throw new Error("モデルの取得に失敗しました");
          const buffer = await res.arrayBuffer();
          cached = { url: currentModelUrl, buffer };
          modelBufferCacheRef.current = cached;
        }
        if (cancelled) return;

        const augmented = injectHoleMarkers(cached.buffer, markers);
        const blob = new Blob([augmented], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (markerBlobUrlRef.current) URL.revokeObjectURL(markerBlobUrlRef.current);
        markerBlobUrlRef.current = url;
        setMarkerModelUrl(url);
      } catch (error) {
        console.error("hole marker preview failed", error);
        setMarkerModelUrl(null);
      }
    }

    rebuild();
    return () => {
      cancelled = true;
    };
  }, [currentModelUrl, holePosition, bottomHolePosition]);

  useEffect(() => {
    return () => {
      if (markerBlobUrlRef.current) URL.revokeObjectURL(markerBlobUrlRef.current);
    };
  }, []);

  const displayModelUrl = markerModelUrl ?? currentModelUrl ?? undefined;

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
    setValue("holePosition", null);
    setValue("bottomHolePosition", null);
    setPlacingHoleTarget(null);
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

      const res = await fetch("/api/generate-model", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成開始に失敗しました");

      setModelState({ phase: "polling", progress: 0 });
      pollStatus(
        json.taskId as string,
        finishedPreviewUrls,
        (json.referenceImageUrls as string[]) ?? []
      );
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
    setValue("holePosition", null);
    setValue("bottomHolePosition", null);
    setPlacingHoleTarget(null);
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

  function updatePlacementPoint(
    viewer: ModelViewerElement,
    event: React.PointerEvent<HTMLElement>
  ) {
    const rect = viewer.getBoundingClientRect();
    const hit = viewer.positionAndNormalFromPoint(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (!hit) return;

    const point = {
      x: hit.position.x,
      y: hit.position.y,
      z: hit.position.z,
      nx: hit.normal.x,
      ny: hit.normal.y,
      nz: hit.normal.z,
    };
    if (placingHoleTarget === "top") {
      setValue("holePosition", point);
    } else if (placingHoleTarget === "bottom") {
      setValue("bottomHolePosition", point);
    }
  }

  // Camera rotation (model-viewer's own camera-controls) is left fully enabled
  // at all times, even while placing a hole. A "tap" (small movement, short
  // duration) places/moves the point; anything bigger is treated as a drag to
  // orbit the camera and is left alone, so users can freely rotate to see the
  // underside of the model before tapping where they want the hole.
  const TAP_MAX_DISTANCE_PX = 8;
  const TAP_MAX_DURATION_MS = 400;

  function handlePlacementPointerDown(
    viewer: ModelViewerElement | null,
    event: React.PointerEvent<HTMLElement>
  ) {
    if (!placingHoleTarget || !viewer) return;
    pointerDownInfoRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
  }

  function handlePlacementPointerUp(
    viewer: ModelViewerElement | null,
    event: React.PointerEvent<HTMLElement>
  ) {
    if (!placingHoleTarget || !viewer) return;
    const start = pointerDownInfoRef.current;
    pointerDownInfoRef.current = null;
    if (!start) return;

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const duration = Date.now() - start.time;
    if (distance > TAP_MAX_DISTANCE_PX || duration > TAP_MAX_DURATION_MS) {
      return; // was a drag to orbit the camera, not a tap to place the hole
    }
    updatePlacementPoint(viewer, event);
  }

  function normalAttr(
    point: { nx?: number; ny?: number; nz?: number },
    fallback: readonly [number, number, number]
  ): string {
    const [fx, fy, fz] = fallback;
    const nx = point.nx ?? fx;
    const ny = point.ny ?? fy;
    const nz = point.nz ?? fz;
    return `${nx}m ${ny}m ${nz}m`;
  }

  function startPlacing(target: "top" | "bottom") {
    setPlacingHoleTarget((prev) => (prev === target ? null : target));
    setExpandedView("model");
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
            </>
          )}
          {modelState.phase === "success" && (
            <model-viewer
              ref={modelViewerRef}
              src={displayModelUrl}
              alt="生成された3Dモデルのプレビュー"
              camera-controls
              auto-rotate={!placingHoleTarget}
              shadow-intensity="1"
              style={{
                width: "100%",
                height: "100%",
                cursor: placingHoleTarget ? "crosshair" : undefined,
              }}
              onPointerDown={(event) =>
                handlePlacementPointerDown(modelViewerRef.current, event)
              }
              onPointerUp={(event) =>
                handlePlacementPointerUp(modelViewerRef.current, event)
              }
            >
              {holePosition && (
                <button
                  type="button"
                  slot="hotspot-hole"
                  data-position={`${holePosition.x}m ${holePosition.y}m ${holePosition.z}m`}
                  data-normal={normalAttr(holePosition, [0, 1, 0])}
                  className="flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-red-500 shadow"
                  aria-label="上の穴（金具用）の位置"
                />
              )}
              {bottomHolePosition && (
                <button
                  type="button"
                  slot="hotspot-bottom-hole"
                  data-position={`${bottomHolePosition.x}m ${bottomHolePosition.y}m ${bottomHolePosition.z}m`}
                  data-normal={normalAttr(bottomHolePosition, [0, -1, 0])}
                  style={{
                    width: `${Math.max(12, (bottomHoleDiameterMm ?? 10) * 1.2)}px`,
                    height: `${Math.max(12, (bottomHoleDiameterMm ?? 10) * 1.2)}px`,
                  }}
                  className="-translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow"
                  aria-label="下の穴（コルク用）の位置"
                />
              )}
            </model-viewer>
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

      {hasAnySuccessfulPreview && (
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
            ? "この形状でもう一度3Dプレビューを作る（1クレジット）"
            : "この形状で3Dプレビューを作る（1クレジット）"}
        </button>
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
          <p className="text-xs text-slate-600">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
            上の穴（金具用）を開ける位置をモデル上で指定できます（回転させてタップするだけ）
          </p>
          <button
            type="button"
            onClick={() => startPlacing("top")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <MapPin className="h-3.5 w-3.5" />
            {placingHoleTarget === "top"
              ? "指定中（完了するには下のボタン）"
              : holePosition
                ? "位置を選び直す"
                : "位置を指定する"}
          </button>
          {holePosition && placingHoleTarget !== "top" && (
            <p className="mt-1 text-xs text-slate-500">
              位置を指定しました（座標: x={holePosition.x.toFixed(2)}, y=
              {holePosition.y.toFixed(2)}, z={holePosition.z.toFixed(2)}）
            </p>
          )}
        </div>
      )}

      {modelState.phase === "success" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
            下の穴（コルク用・レジン充填口）の位置と大きさを指定できます
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startPlacing("bottom")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              {placingHoleTarget === "bottom"
                ? "指定中（完了するには下のボタン）"
                : bottomHolePosition
                  ? "位置を選び直す"
                  : "位置を指定する"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              直径
              <input
                type="number"
                min={MIN_BOTTOM_HOLE_DIAMETER_MM}
                max={MAX_BOTTOM_HOLE_DIAMETER_MM}
                value={bottomHoleDiameterMm ?? DEFAULT_BOTTOM_HOLE_DIAMETER_MM}
                onChange={(e) =>
                  setValue("bottomHoleDiameterMm", Number(e.target.value))
                }
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
              mm
            </label>
          </div>
          {bottomHolePosition && placingHoleTarget !== "bottom" && (
            <p className="mt-1 text-xs text-slate-500">
              位置を指定しました（座標: x={bottomHolePosition.x.toFixed(2)}, y=
              {bottomHolePosition.y.toFixed(2)}, z=
              {bottomHolePosition.z.toFixed(2)}）
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            ※ここで指定した位置・大きさをもとに、製造時に自動で穴あけ加工されます
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
          onClick={() => setExpandedView(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedView(null)}
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
                auto-rotate={!placingHoleTarget}
                shadow-intensity="1"
                style={{
                  width: "100%",
                  height: "100%",
                  cursor: placingHoleTarget ? "crosshair" : undefined,
                }}
                onPointerDown={(event) =>
                  handlePlacementPointerDown(modalModelViewerRef.current, event)
                }
                onPointerUp={(event) =>
                  handlePlacementPointerUp(modalModelViewerRef.current, event)
                }
              >
                {holePosition && (
                  <button
                    type="button"
                    slot="hotspot-hole"
                    data-position={`${holePosition.x}m ${holePosition.y}m ${holePosition.z}m`}
                    data-normal={normalAttr(holePosition, [0, 1, 0])}
                    className="flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-red-500 shadow"
                    aria-label="上の穴（金具用）の位置"
                  />
                )}
                {bottomHolePosition && (
                  <button
                    type="button"
                    slot="hotspot-bottom-hole"
                    data-position={`${bottomHolePosition.x}m ${bottomHolePosition.y}m ${bottomHolePosition.z}m`}
                    data-normal={normalAttr(bottomHolePosition, [0, -1, 0])}
                    style={{
                      width: `${Math.max(12, (bottomHoleDiameterMm ?? 10) * 1.2)}px`,
                      height: `${Math.max(12, (bottomHoleDiameterMm ?? 10) * 1.2)}px`,
                    }}
                    className="-translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow"
                    aria-label="下の穴（コルク用）の位置"
                  />
                )}
              </model-viewer>
            )}
            {expandedView === "model" && placingHoleTarget && (
              <>
                <p className="pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm font-medium text-white">
                  モデルを回転・拡大できます。
                  {placingHoleTarget === "top" ? "上の穴" : "下の穴"}
                  を開けたい場所を軽くタップしてください
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPlacingHoleTarget(null);
                  }}
                  className="absolute inset-x-0 bottom-4 z-10 mx-auto w-fit rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100"
                >
                  完了
                </button>
              </>
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
