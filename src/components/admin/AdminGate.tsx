"use client";

import { FirebaseError } from "firebase/app";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  sendAdminPasswordResetEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
} from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/admin";

function describeAuthError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      return "パスワードが違います";
    }
    if (err.code === "auth/user-not-found") {
      return "このメールアドレスにはまだパスワードが設定されていません。下の「パスワードを設定する」から設定してください";
    }
    if (err.code === "auth/too-many-requests") {
      return "試行回数が多すぎます。しばらくしてからもう一度お試しください";
    }
  }
  return "ログインに失敗しました";
}

function PasswordLoginForm() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmailPassword(ADMIN_EMAIL, password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReset() {
    setSubmitting(true);
    setError(null);
    try {
      await sendAdminPasswordResetEmail(ADMIN_EMAIL);
      setResetSent(true);
    } catch {
      setError("送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2 text-left">
      <label className="block text-xs text-slate-500" htmlFor="admin-password">
        パスワードでログイン（{ADMIN_EMAIL}）
      </label>
      <input
        id="admin-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
      />
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {submitting ? "処理中..." : "ログイン"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {resetSent ? (
        <p className="text-xs text-emerald-600">
          パスワード設定用のメールを送信しました。届いたメールのリンクからパスワードを設定してください
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSendReset}
          disabled={submitting}
          className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-60"
        >
          パスワードを設定する（初回 / 忘れた場合）
        </button>
      )}
    </form>
  );
}

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
        <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          Googleログインが上手くいかない場合
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <PasswordLoginForm />
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center text-sm text-slate-600">
        <p>
          このアカウント（{user.email}）には管理画面への権限がありません
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ログアウトして別のアカウントでログイン
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
