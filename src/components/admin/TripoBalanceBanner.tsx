"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type Balance = { available: number; blockBelow: number; warnBelow: number };

// Shows the Tripo (3D generation) credit balance on the admin home. Silent while it's healthy;
// turns into a call to top up before customers' model generation starts getting paused.
export function TripoBalanceBanner() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/admin/tripo-balance", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok && !cancelled) setBalance(await res.json());
      } catch {
        // A balance hiccup shouldn't get in the way of the order list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!balance) return null;
  const empty = balance.available < balance.blockBelow;
  const low = balance.available < balance.warnBelow;
  if (!low) {
    return (
      <p className="mb-4 text-xs text-slate-400">
        Tripo残高: {balance.available}クレジット（約{Math.floor(balance.available / 30)}体分）
      </p>
    );
  }
  return (
    <div
      className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
        empty
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      <p className="font-semibold">
        {empty
          ? "Tripoの残高がなく、3Dモデル生成を一時停止しています"
          : "Tripoの残高が少なくなっています"}
      </p>
      <p className="mt-0.5 text-xs">
        残り{balance.available}クレジット（約{Math.floor(balance.available / 30)}体分）。
        <a
          href="https://platform.tripo3d.ai/"
          target="_blank"
          rel="noreferrer"
          className="ml-1 underline underline-offset-2"
        >
          Tripoでチャージする
        </a>
      </p>
    </div>
  );
}
