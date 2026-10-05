"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CREDIT_PACKS, CREDIT_PRICE_YEN, MAX_CUSTOM_CREDITS } from "@/lib/creditPacks";

export function CreditPurchase() {
  const { user } = useAuth();
  const [pending, setPending] = useState<string | "custom" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState(1);
  const [returned, setReturned] = useState<"success" | "cancel" | null>(null);

  // Back from Stripe (see returnTo in /api/stripe/checkout): the unfinished build was restored from
  // the saved draft, so just say what happened and tidy the URL.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("credit");
    if (result === "success" || result === "cancel") {
      setReturned(result);
      const url = new URL(window.location.href);
      url.searchParams.delete("credit");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  if (!user) return null;

  async function handlePurchase(body: { packId: string } | { customCredits: number }) {
    if (!user) return;
    setPending("packId" in body ? body.packId : "custom");
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...body, returnTo: window.location.pathname }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "購入処理に失敗しました");
      }
      window.location.assign(json.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "購入処理に失敗しました");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {returned === "success" && (
        <p className="w-full text-right text-xs font-medium text-emerald-700">
          購入ありがとうございます。入力した内容はそのまま残っています。続きからお進みください（反映まで数秒かかることがあります）
        </p>
      )}
      {returned === "cancel" && (
        <p className="w-full text-right text-xs text-slate-500">購入は完了していません。入力した内容は残っています。</p>
      )}
      {CREDIT_PACKS.map((pack) => (
        <button
          key={pack.id}
          type="button"
          onClick={() => handlePurchase({ packId: pack.id })}
          disabled={pending !== null}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending === pack.id ? "処理中..." : `${pack.credits}回分 / ¥${pack.priceYen}`}
        </button>
      ))}

      <div className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white pl-3 pr-1.5 py-1">
        <input
          type="number"
          min={1}
          max={MAX_CUSTOM_CREDITS}
          value={customCredits}
          onChange={(e) =>
            setCustomCredits(
              Math.min(MAX_CUSTOM_CREDITS, Math.max(1, Number(e.target.value) || 1))
            )
          }
          disabled={pending !== null}
          className="w-12 text-xs text-slate-700 outline-none disabled:opacity-50"
        />
        <span className="text-xs text-slate-500">
          回分 / ¥{customCredits * CREDIT_PRICE_YEN}
        </span>
        <button
          type="button"
          onClick={() => handlePurchase({ customCredits })}
          disabled={pending !== null}
          className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending === "custom" ? "処理中..." : "購入"}
        </button>
      </div>

      <p className="w-full text-right text-[11px] text-slate-500">
        ※購入したクレジットは、お客様都合による返金はできません。有効期限は、最後にご購入・ご利用いただいた日から1年です（詳しくは特定商取引法に基づく表記をご覧ください）。
      </p>
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
