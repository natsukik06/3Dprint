"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkPrinterStatus,
  printLabelSets,
  type LabelOrder,
  type PrinterStatus,
} from "@/lib/labelPrintClient";

// "ラベルを一式印刷" -- prints each order's contents label together with the brand-logo seal and
// the thank-you insert on the Brother QL-800, through the local print bridge. Shows live whether
// the printer is actually reachable, and only enables the button when it is.
export function PrintLabelSetButton({
  orders,
  buttonLabel,
}: {
  orders: LabelOrder[];
  buttonLabel: string;
}) {
  const [status, setStatus] = useState<PrinterStatus>({ kind: "checking" });
  const [includeLogoAndThanks, setIncludeLogoAndThanks] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const refresh = useCallback(() => {
    checkPrinterStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    // Cheap re-check so the badge follows the printer being plugged in / the server being started.
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function handlePrint() {
    setPrinting(true);
    setError(null);
    setDone(null);
    try {
      await printLabelSets(orders, { includeLogoAndThanks });
      setDone(
        `${orders.length}件ぶんを印刷しました（${includeLogoAndThanks ? "内容物＋ロゴ＋感謝文" : "内容物のみ"}）`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "印刷に失敗しました");
      refresh();
    } finally {
      setPrinting(false);
    }
  }

  const badge =
    status.kind === "ready"
      ? { text: "プリンター接続OK", cls: "bg-emerald-100 text-emerald-700" }
      : status.kind === "checking"
        ? { text: "確認中...", cls: "bg-slate-100 text-slate-500" }
        : status.kind === "server_down"
          ? { text: "印刷サーバー未起動", cls: "bg-amber-100 text-amber-700" }
          : { text: "プリンター未接続", cls: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing || status.kind !== "ready" || orders.length === 0}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {printing ? "印刷中..." : buttonLabel}
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
        <button
          type="button"
          onClick={refresh}
          className="text-xs text-slate-500 underline underline-offset-2"
        >
          再確認
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={includeLogoAndThanks}
          onChange={(e) => setIncludeLogoAndThanks(e.target.checked)}
          className="h-3.5 w-3.5 accent-slate-800"
        />
        ロゴ・ご注文の感謝文も一緒に印刷する（内容物ラベルと1セット）
      </label>
      {status.kind === "server_down" && (
        <p className="text-xs text-amber-700">
          このPCで <code>label-pipeline\start_print_server.bat</code> をダブルクリックして起動してから「再確認」を押してください（起動したウィンドウは開いたままにします）。
        </p>
      )}
      {status.kind === "problem" && <p className="text-xs text-red-600">{status.message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-emerald-700">{done}</p>}
    </div>
  );
}
