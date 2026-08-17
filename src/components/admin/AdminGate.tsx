"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { signInWithGoogle } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/admin";

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <p className="mb-4 text-sm text-slate-600">
          管理画面にはログインが必要です
        </p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Googleでログイン
        </button>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center text-sm text-slate-600">
        このアカウントには管理画面への権限がありません
      </div>
    );
  }

  return <>{children}</>;
}
