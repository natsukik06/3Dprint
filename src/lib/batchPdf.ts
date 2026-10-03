import { jsPDF } from "jspdf";
import { summarizeOrderItemForLabel } from "@/lib/labelCommands";
import type { OrderItemDraft } from "@/types/order";

export type BatchPdfOrder = {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  postalCode?: string;
  address?: string;
  shippingMethod?: string;
  items: OrderItemDraft[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// jsPDF's built-in fonts have no Japanese glyphs -- drawing text directly would come out as
// blank boxes. Rendering through doc.html() rasterizes this DOM via html2canvas instead (any web
// font works, since it becomes an image), so no CJK font needs to be embedded.
function buildSummaryHtml(batchId: string, createdAtLabel: string, orders: BatchPdfOrder[]): string {
  const orderCards = orders
    .map((order) => {
      const itemLines = order.items
        .map((item) => `<div>${escapeHtml(summarizeOrderItemForLabel(item))}</div>`)
        .join("");
      return `
        <div style="border:1px solid #ccc;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
          <div style="font-weight:bold;font-size:14px;">
            注文番号: ${escapeHtml(order.orderNumber ?? order.orderId)}
          </div>
          <div style="font-size:12px;color:#444;margin-top:4px;">
            ${escapeHtml(order.customerName ?? "")}様　／　${escapeHtml(order.shippingMethod ?? "")}
          </div>
          <div style="font-size:12px;color:#444;">
            〒${escapeHtml(order.postalCode ?? "")}　${escapeHtml(order.address ?? "")}
          </div>
          <div style="font-size:12px;color:#111;margin-top:6px;line-height:1.6;">
            ${itemLines}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;width:760px;padding:24px;background:#fff;">
      <h1 style="font-size:18px;margin:0 0 4px;">印刷バッチ 注文まとめ</h1>
      <p style="font-size:12px;color:#666;margin:0 0 16px;">
        バッチID: ${escapeHtml(batchId)}　／　作成日時: ${escapeHtml(createdAtLabel)}　／　注文数: ${orders.length}件
      </p>
      ${orderCards}
    </div>
  `;
}

// Builds a one-page-per-batch PDF summarizing every order in it (order number, customer,
// address, item contents) -- meant to sit alongside the raw-model files when archiving a batch
// (see the batch page's "バッチ一式を保存"), so together they're a self-contained record of what the
// batch was.
export function buildBatchSummaryPdfBlob(
  batchId: string,
  createdAtLabel: string,
  orders: BatchPdfOrder[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.innerHTML = buildSummaryHtml(batchId, createdAtLabel, orders);
    document.body.appendChild(container);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc
      .html(container, {
        margin: [24, 24, 24, 24],
        autoPaging: "text",
        html2canvas: { scale: 0.75 },
        width: 547, // A4 pt width (595) minus left+right margins
        windowWidth: 760,
        callback: (finishedDoc) => {
          document.body.removeChild(container);
          resolve(finishedDoc.output("blob"));
        },
      })
      .catch((error: unknown) => {
        document.body.removeChild(container);
        reject(error);
      });
  });
}

export async function downloadBatchSummaryPdf(
  batchId: string,
  createdAtLabel: string,
  orders: BatchPdfOrder[]
): Promise<void> {
  const blob = await buildBatchSummaryPdfBlob(batchId, createdAtLabel, orders);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `batch-${batchId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
