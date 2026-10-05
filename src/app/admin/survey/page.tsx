"use client";

import { collection, getDocs, orderBy, query, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { SURVEY_PRICE_LABELS, type SurveyAnswers } from "@/types/survey";

type Row = SurveyAnswers & { id: string; email?: string; createdAt?: Timestamp };

function average(rows: Row[], key: "satisfaction" | "likeness"): string {
  if (rows.length === 0) return "-";
  return (rows.reduce((s, r) => s + r[key], 0) / rows.length).toFixed(1);
}

export default function AdminSurveyPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "survey_responses"), orderBy("createdAt", "desc"))).then((snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, "id">) })))
    );
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-lg font-bold text-slate-900">アンケート回答</h1>
      <p className="mb-4 text-xs text-slate-500">梱包シールのQRから届いた回答です（1回答につき、クレジット1回分を付与済み）。</p>
      {rows === null ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">まだ回答はありません。</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "回答数", v: String(rows.length) },
              { l: "満足度（平均）", v: average(rows, "satisfaction") },
              { l: "似ている度（平均）", v: average(rows, "likeness") },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] text-slate-500">{s.l}</p>
                <p className="text-xl font-bold text-slate-900">{s.v}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p className="mb-1 text-[11px] text-slate-400">
                  {r.createdAt?.toDate().toLocaleString("ja-JP")} ・ {r.email}
                </p>
                <p>
                  知った場所：{r.foundVia} ／ 満足度 {r.satisfaction} ／ 似ている度 {r.likeness} ／ 価格：
                  {SURVEY_PRICE_LABELS[r.priceFeel]} ／ {r.wouldRecommend ? "すすめたい" : "すすめない・どちらでもない"}
                </p>
                {r.comment && (
                  <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">
                    {r.comment}
                    {r.allowQuote && <span className="ml-1 font-semibold text-emerald-700">（匿名での紹介OK）</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
