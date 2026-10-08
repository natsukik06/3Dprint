"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BusyBanner } from "@/components/order/BusyBanner";
import type { ImagePayload } from "@/lib/gemini";
import { POSE_LABELS } from "@/lib/pricing";
import { POSE_SET_POSES, type ModelStyle, type PetDetails, type Pose } from "@/types/order";

// 「いろんなポーズを試す」: before making the 4-view images / 3D model, a customer who is not sure which
// pose to choose can have the 5 famous poses drawn once (one image-making try, free within the daily
// limit), look at them, and pick one. Picking only sets the normal ポーズ choice -- the model itself is
// made by the usual flow (step 1 → step 2), so nothing extra is charged and the 5 pictures are just a
// preview to choose from.
export function PoseTryOut({
  photos,
  subject,
  petDetails,
  modelStyle,
  pose,
  onPick,
}: {
  photos: File[];
  subject: string;
  petDetails: PetDetails;
  modelStyle: ModelStyle;
  pose: Pose;
  onPick: (pose: Pose) => void;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "generating" }
    | { phase: "done"; views: Record<Pose, ImagePayload> }
    | { phase: "error"; message: string }
  >({ phase: "idle" });

  const ready = photos.length > 0 && subject.trim().length > 0;

  async function generate() {
    if (!user || !ready) return;
    setState({ phase: "generating" });
    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      photos.forEach((file) => formData.append("photos", file));
      formData.append("subject", subject);
      formData.append("subjectType", "pet");
      formData.append("modelStyle", modelStyle);
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
      if (!res.ok) throw new Error(json.error ?? "ポーズを作れませんでした");
      setState({ phase: "done", views: json.poseViews as Record<Pose, ImagePayload> });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "ポーズを作れませんでした" });
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <BusyBanner
        active={state.phase === "generating"}
        title="ボタンを受け付けました。5つのポーズを作っています"
        detail="1分ほどかかります。このままお待ちください"
      />
      <p className="text-xs font-medium text-slate-700">どのポーズにするか迷ったら</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        5つの人気ポーズを、まとめて見てから選べます（イメージ作り1回分・1日の無料回数を使います）。気に入ったものをタップすると、そのポーズで作れます。
      </p>
      <button
        type="button"
        onClick={generate}
        disabled={!ready || state.phase === "generating"}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.phase === "generating"
          ? "✓ 受け付けました。5つのポーズを作っています…"
          : state.phase === "done"
            ? "もう一度、5つのポーズを作る"
            : "いろんなポーズを試す"}
      </button>
      {!ready && (
        <p className="text-[11px] text-slate-400">写真と名前を入れると、押せるようになります。</p>
      )}
      {state.phase === "generating" && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">少し時間がかかります</span>
        </div>
      )}
      {state.phase === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      {state.phase === "done" && (
        <div className="grid grid-cols-3 gap-2">
          {POSE_SET_POSES.map((p) => {
            const image = state.views[p];
            const picked = pose === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPick(p)}
                aria-pressed={picked}
                className={`relative overflow-hidden rounded-lg border-2 text-left ${
                  picked ? "border-slate-800" : "border-slate-200"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${image.mimeType};base64,${image.data}`}
                  alt={POSE_LABELS[p]}
                  className="aspect-square w-full bg-white object-cover"
                />
                {picked && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span className="block bg-white px-1.5 py-1 text-[11px] font-medium text-slate-700">
                  {POSE_LABELS[p]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
