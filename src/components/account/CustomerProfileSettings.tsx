"use client";

import { useEffect, useState } from "react";
import { getCustomerProfile, saveCustomerProfile, type CustomerProfile } from "@/lib/customerProfile";

const EMPTY_PROFILE: CustomerProfile = {
  customerName: "",
  postalCode: "",
  address: "",
  phoneNumber: "",
};

const FIELDS: { key: keyof CustomerProfile; label: string; placeholder?: string; type?: string }[] = [
  { key: "customerName", label: "お名前" },
  { key: "postalCode", label: "郵便番号", placeholder: "例：123-4567" },
  { key: "address", label: "配送先住所", placeholder: "都道府県から番地・建物名まで" },
  { key: "phoneNumber", label: "電話番号", type: "tel" },
];

// Lets a signed-in customer view/edit the 注文者情報 saved to their account outside of an actual
// order (see src/lib/customerProfile.ts) -- the order form itself only offers to save it in
// passing at checkout, so this is the one place to fix a typo or move without placing an order.
export function CustomerProfileSettings({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getCustomerProfile(uid).catch(() => null);
      if (cancelled) return;
      if (saved) setProfile({ ...EMPTY_PROFILE, ...saved });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function handleSave() {
    setSaveState("saving");
    try {
      await saveCustomerProfile(uid, profile);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("saveCustomerProfile failed", err);
      setSaveState("error");
    }
  }

  if (!loaded) {
    return (
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">注文者情報の設定</p>
      <p className="mt-1 text-xs text-slate-500">
        ここで保存しておくと、次回以降の注文でこの内容が自動で入力されます
      </p>
      <div className="mt-3 space-y-3">
        {FIELDS.map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label
              htmlFor={`profile-${key}`}
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              {label}
            </label>
            <input
              id={`profile-${key}`}
              type={type ?? "text"}
              placeholder={placeholder}
              value={profile[key]}
              onChange={(e) => setProfile((prev) => ({ ...prev, [key]: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="mt-3 w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saveState === "saving" ? "保存中..." : "保存する"}
      </button>
      {saveState === "saved" && (
        <p className="mt-1.5 text-center text-xs text-emerald-600">✓ 保存しました</p>
      )}
      {saveState === "error" && (
        <p className="mt-1.5 text-center text-xs text-red-600">保存に失敗しました</p>
      )}
    </div>
  );
}
