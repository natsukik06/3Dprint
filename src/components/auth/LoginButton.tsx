"use client";

import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCredits } from "@/components/auth/useCredits";
import { signInWithGoogle, signOut } from "@/lib/auth";

export function LoginButton() {
  const { user, isLoading } = useAuth();
  const credits = useCredits();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (isLoading) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={async () => {
          setIsSigningIn(true);
          try {
            await signInWithGoogle();
          } finally {
            setIsSigningIn(false);
          }
        }}
        disabled={isSigningIn}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <LogIn className="h-3.5 w-3.5" />
        {isSigningIn ? "ログイン中..." : "Googleでログイン"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">
        残りクレジット: <span className="font-semibold">{credits ?? "…"}</span>
      </span>
      <button
        type="button"
        onClick={() => signOut()}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        ログアウト
      </button>
    </div>
  );
}
