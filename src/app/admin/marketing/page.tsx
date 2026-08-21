"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";

function MarketingComposer() {
  const { user } = useAuth();
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    { sent: number; failed: number; total: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      const snap = await getDocs(
        query(collection(db, "marketing_subscribers"), where("subscribed", "==", true))
      );
      if (!cancelled) setSubscriberCount(snap.size);
    }
    loadCount();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSend() {
    if (!user || !subject.trim() || !body.trim()) return;
    if (
      !window.confirm(
        `${subscriberCount ?? "?"}件の配信同意済みお客様に送信します。よろしいですか？`
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const idToken = await user.getIdToken();
      const bodyHtml = body
        .split("\n")
        .map((line) => `<p>${line || "&nbsp;"}</p>`)
        .join("");
      const res = await fetch("/api/admin/marketing/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "送信に失敗しました");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        配信同意済みのお客様：
        <span className="font-semibold text-slate-900">
          {subscriberCount === null ? "..." : `${subscriberCount}件`}
        </span>
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">件名</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="例：期間限定セールのお知らせ"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">本文</label>
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="お知らせ内容を入力してください（改行はそのまま反映されます）"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          配信停止リンクは自動で本文末尾に追加されます
        </p>
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !subject.trim() || !body.trim()}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {sending ? "送信中..." : "送信する"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="text-sm text-emerald-700">
          {result.sent}件送信しました（失敗: {result.failed}件 / 対象: {result.total}件）
        </p>
      )}
    </div>
  );
}

export default function AdminMarketingPage() {
  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <Link
            href="/admin"
            className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2"
          >
            ← 注文一覧に戻る
          </Link>
          <h1 className="mb-6 text-xl font-bold text-slate-900">お知らせメール配信</h1>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <MarketingComposer />
          </div>
        </main>
      </div>
    </AdminGate>
  );
}
