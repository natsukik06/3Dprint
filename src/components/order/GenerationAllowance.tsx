"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PREVIEW_CREDIT_PRICE_YEN } from "@/lib/creditPacks";
import { db } from "@/lib/firebase";

const FREE_GENERATIONS_PER_DAY = 2; // keep in step with src/lib/credits.ts

type Allowance = { freeLeft: number; previewCredits: number; credits: number };

// Reads the signed-in customer's own user doc (allowed by the Firestore rules) and works out how many
// free 4-view / 5-pose image generations are left today (JST, same day boundary as the server), how
// many paid ¥50 preview tickets they hold, and how many 3D-model credits.
function useAllowance(): Allowance | null {
  const { user } = useAuth();
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
      const used = data?.freeGenerationDate === today ? ((data?.freeGenerationCount as number) ?? 0) : 0;
      setAllowance({
        freeLeft: Math.max(0, FREE_GENERATIONS_PER_DAY - used),
        previewCredits: (data?.previewCredits as number) ?? 0,
        credits: (data?.credits as number) ?? 0,
      });
    });
  }, [user]);
  return user ? allowance : null;
}

// Shown above every "make the 4-view / 5-pose images" button, so the customer finds out BEFORE
// building anything that they are out of free tries / credits -- instead of discovering it mid-way and
// being sent off to pay with a half-finished order.
export function GenerationAllowance({ creditsNeeded = 1 }: { creditsNeeded?: number }) {
  const { user } = useAuth();
  const allowance = useAllowance();
  const [buying, setBuying] = useState(false);
  if (!user || !allowance) return null;

  const canGenerate = allowance.freeLeft > 0 || allowance.previewCredits > 0;
  const canModel = allowance.credits >= creditsNeeded;

  async function buyPreview() {
    if (!user || buying) return;
    setBuying(true);
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
      setBuying(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs leading-relaxed ${
        canGenerate && canModel
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}
    >
      <p>
        イメージ作り：今日の無料はあと<b>{allowance.freeLeft}回</b>
        {allowance.previewCredits > 0 && <>＋追加チケット{allowance.previewCredits}枚</>}
        ／ 3Dモデル作り：クレジット<b>{allowance.credits}回分</b>
        {creditsNeeded > 1 && <>（今回は{creditsNeeded}回分必要）</>}
      </p>
      {!canGenerate && (
        <div className="mt-1.5">
          <p>今日の無料分を使い切りました。続けるには、先に追加チケットを買うか、明日お試しください。</p>
          <button
            type="button"
            onClick={buyPreview}
            disabled={buying}
            className="mt-1.5 rounded-full border border-amber-400 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {buying ? "準備中..." : `先に追加チケット（¥${PREVIEW_CREDIT_PRICE_YEN}）を買う`}
          </button>
          <p className="mt-1 text-[11px]">買ったあとは、この画面に戻ります。入力した内容は残ります。</p>
        </div>
      )}
      {canGenerate && !canModel && (
        <p className="mt-1">
          3Dモデルを作るには、クレジットが足りません。ページ右上の購入ボタンから、先に買っておくと、途中で止まりません。
        </p>
      )}
    </div>
  );
}
