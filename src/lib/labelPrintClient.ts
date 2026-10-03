import { orderHasGlow, summarizeOrderItemForLabel } from "@/lib/labelCommands";
import type { OrderItemDraft } from "@/types/order";

// The local print bridge (label-pipeline/server/print_server.mjs, started with
// label-pipeline\start_print_server.bat) -- the browser can't reach a USB printer itself.
const LABEL_SERVER_URL = "http://127.0.0.1:8765";

export type PrinterStatus =
  | { kind: "checking" }
  | { kind: "server_down" }
  | { kind: "problem"; message: string }
  | { kind: "ready" };

export type LabelOrder = { orderNumber: string; items: OrderItemDraft[] };

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPrinterStatus(): Promise<PrinterStatus> {
  try {
    // Generous timeout: the server may be re-attaching the printer to WSL (a few seconds).
    const res = await fetchWithTimeout(`${LABEL_SERVER_URL}/status`, {}, 20000);
    const json = await res.json();
    if (json.state === "ready") return { kind: "ready" };
    return { kind: "problem", message: json.message ?? "プリンターの状態を確認できません" };
  } catch {
    return { kind: "server_down" };
  }
}

// Per order: the contents label, then (unless turned off) the brand-logo seal and the thank-you
// insert -- the same labels print_labels.bat prints, as one set per shipment.
export async function printLabelSets(
  orders: LabelOrder[],
  options: { includeLogoAndThanks: boolean }
): Promise<void> {
  const res = await fetchWithTimeout(
    `${LABEL_SERVER_URL}/print`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: orders.map((o) => ({
          orderNumber: o.orderNumber,
          items: o.items.map(summarizeOrderItemForLabel),
          hasGlow: orderHasGlow(o.items),
        })),
        includeLogo: options.includeLogoAndThanks,
        includeInsert: options.includeLogoAndThanks,
      }),
    },
    // ~15s per order covers three labels plus the attach check.
    60000 + orders.length * 30000
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? "印刷に失敗しました");
}
