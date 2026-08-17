"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CREDIT_PACKS } from "@/lib/creditPacks";

export function CreditPurchase() {
  const { user } = useAuth();
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handlePurchase(packId: string) {
    if (!user) return;
    setPendingPackId(packId);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ packId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "購入処理に失敗しました");
      }
      window.location.assign(json.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "購入処理に失敗しました");
      setPendingPackId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {CREDIT_PACKS.map((pack) => (
        <button
          key={pack.id}
          type="button"
          onClick={() => handlePurchase(pack.id)}
          disabled={pendingPackId !== null}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pendingPackId === pack.id
            ? "処理中..."
            : `${pack.credits}回分 / ¥${pack.priceYen}`}
        </button>
      ))}
      {error && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
