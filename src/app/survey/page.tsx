"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { signInWithGoogle } from "@/lib/auth";
import {
  SURVEY_FOUND_OPTIONS,
  SURVEY_MAX_COMMENT_LENGTH,
  SURVEY_PRICE_LABELS,
  SURVEY_REWARD_CREDITS,
  type SurveyPriceFeel,
} from "@/types/survey";

function ScaleInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`h-11 flex-1 rounded-lg border text-sm font-semibold ${
              value === n
                ? "border-[#0f766e] bg-[#0f766e] text-white"
                : "border-[#d9cbb0] bg-white text-[#3f3424] dark:border-[#232726] dark:bg-[#121415] dark:text-[#eef2f1]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[#8a7c5e] dark:text-[#6d7c79]">{hint}</p>
    </fieldset>
  );
}

export default function SurveyPage() {
  const { user, isLoading } = useAuth();
  const [foundVia, setFoundVia] = useState("");
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [likeness, setLikeness] = useState<number | null>(null);
  const [priceFeel, setPriceFeel] = useState<SurveyPriceFeel | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [allowQuote, setAllowQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete =
    !!foundVia && satisfaction !== null && likeness !== null && priceFeel !== null && wouldRecommend !== null;

  async function submit() {
    if (!user || !complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ foundVia, satisfaction, likeness, priceFeel, wouldRecommend, comment, allowQuote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "送信できませんでした。時間をおいて、もう一度お試しください");
        return;
      }
      setDone(true);
    } catch {
      setError("通信に失敗しました。電波の良い場所で、もう一度お試しください");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <h1 className="mb-2 text-center text-2xl font-semibold">ご利用アンケート</h1>
        <p className="mb-6 text-center text-sm leading-relaxed text-[#6b5c40] dark:text-[#cdbb8a]">
          1分ほどで終わります。ご回答いただいた方に、3Dモデル作成クレジットを{SURVEY_REWARD_CREDITS}回分プレゼントします（1アカウントにつき1回）。
        </p>

        {isLoading ? null : !user ? (
          <div className="rounded-2xl border border-[#d9cbb0] bg-white p-5 text-center dark:border-[#232726] dark:bg-[#121415]">
            <p className="mb-3 text-sm">ご注文時のメールアドレスのアカウントで、ログインしてください。</p>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="rounded-full bg-[#0f766e] px-6 py-3 text-sm font-semibold text-white"
            >
              ログインしてアンケートに答える
            </button>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-[#d9cbb0] bg-white p-5 text-center dark:border-[#232726] dark:bg-[#121415]">
            <p className="mb-2 text-lg font-semibold">ご回答ありがとうございました</p>
            <p className="mb-4 text-sm">3Dモデル作成クレジットを{SURVEY_REWARD_CREDITS}回分、アカウントに追加しました。</p>
            <Link
              href="/order"
              className="inline-block rounded-full bg-[#0f766e] px-6 py-3 text-sm font-semibold text-white"
            >
              注文ページへ
            </Link>
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-[#d9cbb0] bg-white p-5 dark:border-[#232726] dark:bg-[#121415]">
            <div className="space-y-2">
              <label htmlFor="foundVia" className="text-sm font-semibold">
                Charo 3D を、どこで知りましたか？
              </label>
              <select
                id="foundVia"
                value={foundVia}
                onChange={(e) => setFoundVia(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#d9cbb0] bg-white px-3 text-sm text-[#3f3424] dark:border-[#232726] dark:bg-[#0a0a0c] dark:text-[#eef2f1]"
              >
                <option value="">選んでください</option>
                {SURVEY_FOUND_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <ScaleInput
              label="全体の満足度"
              hint="1＝不満　5＝とても満足"
              value={satisfaction}
              onChange={setSatisfaction}
            />
            <ScaleInput
              label="仕上がりは、ペット（元の写真）に似ていましたか？"
              hint="1＝あまり似ていない　5＝そっくり"
              value={likeness}
              onChange={setLikeness}
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">価格は、どう感じましたか？</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(SURVEY_PRICE_LABELS) as SurveyPriceFeel[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPriceFeel(k)}
                    aria-pressed={priceFeel === k}
                    className={`h-11 rounded-lg border px-2 text-sm ${
                      priceFeel === k
                        ? "border-[#0f766e] bg-[#0f766e] font-semibold text-white"
                        : "border-[#d9cbb0] bg-white text-[#3f3424] dark:border-[#232726] dark:bg-[#121415] dark:text-[#eef2f1]"
                    }`}
                  >
                    {SURVEY_PRICE_LABELS[k]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">お友達にもすすめたいですか？</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: true, l: "すすめたい" },
                  { v: false, l: "どちらでもない・すすめない" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => setWouldRecommend(o.v)}
                    aria-pressed={wouldRecommend === o.v}
                    className={`min-h-11 rounded-lg border px-2 text-sm ${
                      wouldRecommend === o.v
                        ? "border-[#0f766e] bg-[#0f766e] font-semibold text-white"
                        : "border-[#d9cbb0] bg-white text-[#3f3424] dark:border-[#232726] dark:bg-[#121415] dark:text-[#eef2f1]"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="comment" className="text-sm font-semibold">
                ご意見・ご感想（任意）
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={SURVEY_MAX_COMMENT_LENGTH}
                rows={4}
                className="w-full rounded-lg border border-[#d9cbb0] bg-white px-3 py-2 text-sm text-[#3f3424] dark:border-[#232726] dark:bg-[#0a0a0c] dark:text-[#eef2f1]"
              />
              <label className="flex items-start gap-2 text-xs text-[#6b5c40] dark:text-[#cdbb8a]">
                <input
                  type="checkbox"
                  checked={allowQuote}
                  onChange={(e) => setAllowQuote(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#0f766e]"
                />
                <span>ご感想を、お名前なし（匿名）で、公式サイトやSNSでご紹介してもよい</span>
              </label>
            </div>

            <p className="text-[11px] leading-relaxed text-[#8a7c5e] dark:text-[#6d7c79]">
              いただいた回答は、サービスの改善のために使います。クレジットは、ご注文済みのメールアドレスのアカウントで、1回だけ付与されます。
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={!complete || submitting}
              className="h-12 w-full rounded-full bg-[#0f766e] text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "送信中…" : `送信して、クレジット${SURVEY_REWARD_CREDITS}回分を受け取る`}
            </button>
            {!complete && (
              <p className="text-center text-[11px] text-[#8a7c5e] dark:text-[#6d7c79]">
                任意以外の項目を、すべて選ぶと送信できます
              </p>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
