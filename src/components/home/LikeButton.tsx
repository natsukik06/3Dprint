"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { Heart } from "lucide-react";
import { db } from "@/lib/firebase";

function storageKey(productId: string): string {
  return `liked:${productId}`;
}

// Anonymous, no-login "気になる！" tap on the lineup -- count lives in Firestore
// (product_likes/{productId}), while which items *this browser* already liked lives in
// localStorage so the heart stays filled on revisit without needing an account.
export function LikeButton({ productId }: { productId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiked(localStorage.getItem(storageKey(productId)) === "1");
    } catch {
      // localStorage unavailable (private browsing etc.) -- just stays un-liked.
    }
    const ref = doc(db, "product_likes", productId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      setCount((snap.data()?.count as number | undefined) ?? 0);
    });
    return unsubscribe;
  }, [productId]);

  async function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => (c === null ? c : Math.max(0, c + (nextLiked ? 1 : -1))));
    try {
      const ref = doc(db, "product_likes", productId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? ((snap.data().count as number) ?? 0) : 0;
        const next = Math.max(0, current + (nextLiked ? 1 : -1));
        tx.set(ref, { count: next });
      });
      try {
        if (nextLiked) localStorage.setItem(storageKey(productId), "1");
        else localStorage.removeItem(storageKey(productId));
      } catch {
        // Non-fatal -- the like still recorded server-side, just won't be remembered locally.
      }
    } catch (error) {
      console.error("failed to toggle like", error);
      setLiked(!nextLiked);
      setCount((c) => (c === null ? c : Math.max(0, c - (nextLiked ? 1 : -1))));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "気になるを取り消す" : "気になる！"}
      className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-transform active:scale-95"
    >
      <Heart
        className={`h-3 w-3 ${liked ? "fill-[#ff6b6b] text-[#ff6b6b]" : "fill-none text-white"}`}
      />
      {count !== null && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
