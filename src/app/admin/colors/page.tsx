"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { colorImageSrc, colorLabel, defaultColorSettings, type ColorSetting, type ColorSettingPatch, type ColorSettingsMap } from "@/lib/colorSettings";
import { DEFAULT_COLOR_IMAGE_SRC } from "@/lib/colorSwatches";
import { storage } from "@/lib/firebase";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";
import { MAGIC_COLOR_OPTIONS, SIZE_OPTIONS, type MagicColor, type SizeOption } from "@/types/order";

// Short chips for the per-size price grid -- SIZE_LABELS in types/order.ts is the full
// customer-facing sentence ("小サイズ（最大辺2.5cm・中実・クリックポスト配送）"), too long for a
// compact admin row.
const SIZE_SHORT_LABELS: Record<SizeOption, string> = {
  solid30: "30",
  solid35: "35",
  solid40: "40",
  solid50: "50",
  solid60: "60",
  solid70: "70",
  M: "M",
};

// Grouped the same way the customer-facing picker is (see COLOR_GROUPS in SpecOptions.tsx), so
// toggling here maps 1:1 onto what shows up in the shop -- just without the tab UI, since the
// admin wants to see (and edit) every color at once.
const ADMIN_GROUPS: { label: string; colors: readonly MagicColor[] }[] = [
  {
    label: "クリアカラー（基本色）",
    colors: ["pureClear", "frosted", "smokeOnyx", "clearBlue", "clearRed", "clearYellow"],
  },
  {
    label: "クリアカラー（混色）",
    colors: ["clearPink", "clearGreen", "clearPurple", "clearOrange"],
  },
  { label: "ソリッド・ラメ", colors: ["pureBlack", "pureWhite", "stardustBlack"] },
  {
    label: "蓄光カラー",
    colors: [
      "starryBlue",
      "nebulaPink",
      "clearAurora",
      "galaxyGreen",
      "cometOrange",
      "cosmicPurple",
      "marsRed",
    ],
  },
  { label: "機能オプション", colors: ["furCavity"] },
];

function ColorRow({
  color,
  value,
  savingColor,
  onSave,
}: {
  color: MagicColor;
  value: ColorSetting;
  savingColor: MagicColor | null;
  onSave: (color: MagicColor, patch: ColorSettingPatch) => Promise<void>;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isBusy = savingColor === color || uploading;
  const effectiveLabel = colorLabel({ [color]: value } as ColorSettingsMap, color, MAGIC_COLOR_LABELS[color]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `colors/${color}-${Date.now()}.${extension}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);
      await onSave(color, { imageUrl });
    } finally {
      setUploading(false);
    }
  }

  const imageSrc = colorImageSrc(
    { [color]: value } as ColorSettingsMap,
    color,
    DEFAULT_COLOR_IMAGE_SRC[color]
  );

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={isBusy}
          onChange={(e) => onSave(color, { enabled: e.target.checked })}
          className="h-4 w-4 shrink-0 accent-slate-800"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
          title="スワッチ画像を変更"
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- may be a Firebase Storage URL
            <img src={imageSrc} alt={effectiveLabel} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
              画像なし
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[9px] text-slate-600">
              保存中
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          // Uncontrolled on purpose -- keyed on the last-saved value so it remounts (and picks up
          // the fresh defaultValue) whenever the server confirms a change, but otherwise leaves
          // whatever the admin is mid-typing alone between keystrokes.
          key={`label-${effectiveLabel}`}
          type="text"
          defaultValue={effectiveLabel}
          disabled={isBusy}
          onBlur={(e) => {
            if (e.target.value.trim()) onSave(color, { label: e.target.value.trim() });
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-10 text-xs text-slate-600">
        <span className="text-slate-400">サイズ別追加料金</span>
        {SIZE_OPTIONS.map((size) => (
          <label key={size} className="flex items-center gap-1">
            <span className="text-slate-500">{SIZE_SHORT_LABELS[size]}</span>
            <span>+¥</span>
            <input
              key={`price-${size}-${value.priceYenBySize[size]}`}
              type="number"
              min={0}
              step={50}
              defaultValue={value.priceYenBySize[size]}
              disabled={isBusy}
              onBlur={(e) =>
                onSave(color, { priceYenBySize: { [size]: Number(e.target.value) || 0 } })
              }
              className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 text-right outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </label>
        ))}
      </div>
      <div className="pl-10">
        <label className="block text-xs text-slate-500">
          完成イメージ(AI)の色の指示（任意・英語で／空欄＝標準）
          <input
            key={`pp-${value.previewPrompt ?? ""}`}
            type="text"
            defaultValue={value.previewPrompt ?? ""}
            disabled={isBusy}
            placeholder="例：a pale, delicate pink tint on clear resin, thin and light, see-through"
            onBlur={(e) => {
              if (e.target.value.trim() !== (value.previewPrompt ?? "")) {
                onSave(color, { previewPrompt: e.target.value });
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
        </label>
        <p className="mt-1 text-[11px] text-slate-400">
          色見本の写真をアップロードしてあると、その実物写真もAIに「この質感・色の濃さに合わせて」と渡します。
        </p>
      </div>
    </div>
  );
}

function ColorSettingsEditor() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ColorSettingsMap | null>(null);
  const [savingColor, setSavingColor] = useState<MagicColor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/color-settings", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (cancelled) return;
      if (res.ok) {
        setSettings(await res.json());
      } else {
        setSettings(defaultColorSettings());
        setError("設定の読み込みに失敗しました（デフォルト値を表示しています）");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function save(color: MagicColor, patch: ColorSettingPatch) {
    if (!user || !settings) return;
    const prev = settings[color];
    // Deep-merge priceYenBySize specifically -- a patch only ever touches one size at a time (see
    // the per-size inputs below), so a shallow spread would otherwise drop every other size from
    // the optimistic UI state.
    const next = {
      ...prev,
      ...patch,
      priceYenBySize: { ...prev.priceYenBySize, ...patch.priceYenBySize },
    };
    // Optimistic update -- rolled back below if the write fails.
    setSettings({ ...settings, [color]: next });
    setSavingColor(color);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/color-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ [color]: patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setSettings(json);
    } catch (err) {
      setSettings((current) => (current ? { ...current, [color]: prev } : current));
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSavingColor(null);
    }
  }

  if (!settings) {
    return <p className="text-sm text-slate-500">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ADMIN_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">{group.label}</h2>
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {group.colors.map((color) => (
              <ColorRow
                key={color}
                color={color}
                value={settings[color]}
                savingColor={savingColor}
                onSave={save}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400">
        全{MAGIC_COLOR_OPTIONS.length}色中、チェックが入っている色だけが注文フォームに表示されます。スワッチ画像はアイコンをタップして差し替え、名前は直接編集できます（空欄のまま外すと変更されません）。サイズ別追加料金は各サイズの基本料金に上乗せする金額です（0円なら追加料金なし、サイズごとに別々に設定できます）。変更は即座に反映されます。
      </p>
    </div>
  );
}

export default function AdminColorsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
      >
        ← 注文一覧に戻る
      </Link>
      <h1 className="mb-2 text-xl font-bold text-slate-900">カラー設定</h1>
      <p className="mb-6 text-sm text-slate-500">
        注文フォームに表示するカラー・名前・スワッチ画像・色ごとの追加料金を管理します。
      </p>
      <ColorSettingsEditor />
    </main>
  );
}
