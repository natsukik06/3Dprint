"use client";

import { collection, doc, limit, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { signInWithGoogle } from "@/lib/auth";
import { db } from "@/lib/firebase";

function toMillis(value: Timestamp | null | undefined): number {
  return value ? value.toMillis() : 0;
}

// Red unread-dot logic for マイページ, live year-round on every page's header (not just
// /mypage itself) -- "something happened since you last checked": either a new discountable
// credit landed (couponUpdatedAt, see addDiscountableCredit in src/lib/credits.ts) or a 3D model
// finished generating (the latest doc in users/{uid}/models, written by PreviewPanel/DuoBuilder/
// PoseSetBuilder's poll success handlers). Compared against lastSeenNotificationsAt, which /mypage
// stamps to "now" on every visit.
function useHasUnreadNotifications(uid: string | undefined): boolean {
  const [lastSeenAt, setLastSeenAt] = useState<Timestamp | null>(null);
  const [couponUpdatedAt, setCouponUpdatedAt] = useState<Timestamp | null>(null);
  const [generationCreditsAvailable, setGenerationCreditsAvailable] = useState(0);
  const [latestModelAt, setLatestModelAt] = useState<Timestamp | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data();
      setLastSeenAt((data?.lastSeenNotificationsAt as Timestamp) ?? null);
      setCouponUpdatedAt((data?.couponUpdatedAt as Timestamp) ?? null);
      setGenerationCreditsAvailable((data?.generationCreditsAvailable as number) ?? 0);
    });
    const unsubModels = onSnapshot(
      query(collection(db, "users", uid, "models"), orderBy("createdAt", "desc"), limit(1)),
      (snap) => {
        setLatestModelAt((snap.docs[0]?.data()?.createdAt as Timestamp) ?? null);
      }
    );
    return () => {
      unsubUser();
      unsubModels();
    };
  }, [uid]);

  const lastSeenMs = toMillis(lastSeenAt);
  const hasNewCoupon = generationCreditsAvailable > 0 && toMillis(couponUpdatedAt) > lastSeenMs;
  const hasNewModel = toMillis(latestModelAt) > lastSeenMs;
  return hasNewCoupon || hasNewModel;
}

// Sitewide login entry point (header nav on every page) -- previously the only way to sign in was
// to stumble into it inside /order or /mypage. Signed-in visitors get a straight link to their
// account instead of a second "log in" prompt.
export function AuthNavButton({ className }: { className?: string }) {
  const { user, isLoading } = useAuth();
  const hasUnread = useHasUnreadNotifications(user?.uid);

  if (isLoading) return null;

  if (user) {
    return (
      <Link href="/mypage" className={`relative inline-block ${className ?? ""}`}>
        マイページ
        {hasUnread && (
          <span
            aria-label="新しい通知があります"
            className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500"
          />
        )}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => signInWithGoogle()} className={className}>
      ログイン・新規登録
    </button>
  );
}
