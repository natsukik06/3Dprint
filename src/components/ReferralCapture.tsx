"use client";

import { useEffect } from "react";

export const REFERRAL_STORAGE_KEY = "pendingReferral";

// Reads ?ref=<uid> off the current URL (a friend's invite link) and remembers it in
// localStorage until sign-in happens -- reads window.location.search directly instead of
// useSearchParams so this can sit in the root layout without forcing every page into dynamic
// rendering / a Suspense boundary. See claimPendingReferral in src/lib/auth.ts for the other
// half (what happens with the stored value once the visitor actually signs up).
export function ReferralCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    } catch {
      // localStorage unavailable (private browsing etc.) -- referral just won't be captured.
    }
  }, []);

  return null;
}
