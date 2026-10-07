"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { LAB_FEATURES_PUBLIC, canUseLabFeatures } from "@/lib/labFeatures";

// テスト用ページ: the two modes that are 準備中 for customers (2匹セット / 5ポーズセット) can only be tried
// by the shop owner. Open them from here; the order page unlocks them automatically while signed in as
// the admin account. To open them to everyone, set LAB_FEATURES_PUBLIC = true in src/lib/labFeatures.ts.
export default function AdminLabPage() {
  const { user } = useAuth();
  const unlocked = canUseLabFeatures(user?.email);
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-sm text-slate-600 underline underline-offset-2">
        ← 管理画面
      </Link>
      <h1 className="mt-2 text-lg font-bold text-slate-900">テスト用ページ（準備中の機能）</h1>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        お客様には「準備中」と表示され、使えない機能を、ここから試せます。生成と3Dモデル作成は、本物のクレジットと画像生成の費用を使います。
      </p>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-semibold text-slate-900">いまの状態</p>
        <ul className="mt-2 space-y-1.5 text-slate-700">
          <li>
            ・お客様への公開：
            <b className={LAB_FEATURES_PUBLIC ? "text-emerald-700" : "text-amber-700"}>
              {LAB_FEATURES_PUBLIC ? "公開中" : "準備中（お客様は使えません）"}
            </b>
          </li>
          <li>
            ・あなた（このログイン）：
            <b className={unlocked ? "text-emerald-700" : "text-red-700"}>
              {unlocked ? "使えます" : "管理者でログインしてください"}
            </b>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">おそろいセット（2匹一緒に）</p>
          <p className="mt-1 text-xs text-slate-500">
            2匹の写真から、4方向の画像を作る機能です。デフォルメ／リアルを選べます。構図は、背中にのる、くっついて眠る、などがあります。
          </p>
          <Link
            href="/order"
            className="mt-2 inline-block rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            注文ページで試す → 「おそろいセット」を選ぶ
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">5ポーズセット</p>
          <p className="mt-1 text-xs text-slate-500">
            同じ子の5つのポーズを、1枚の絵からまとめて作り、選んだポーズを、1枚の画像から直接3Dにする機能です（1ポーズ2クレジット）。お客様向けの「いろんなポーズを試す」（ポーズを見て選ぶだけ）は、通常の「写真からAIで作る」の中で、すでに公開しています。
          </p>
          <Link
            href="/order"
            className="mt-2 inline-block rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            注文ページで試す → 「5ポーズセット」を選ぶ
          </Link>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        テストに使った注文は、本物の注文と混ざらないよう、お名前に「TEST」と入れ、終わったら削除してください。
        お客様に公開するときは、<code>src/lib/labFeatures.ts</code> の <code>LAB_FEATURES_PUBLIC</code> を true にします。
      </p>
    </main>
  );
}
