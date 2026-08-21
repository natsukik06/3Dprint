import { formatYen } from "@/lib/pricing";
import type { OrderItemDraft } from "@/types/order";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared plain, email-client-safe wrapper (inline styles only -- no external CSS/fonts).
function wrapEmail(bodyHtml: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b;">
      ${bodyHtml}
      <p style="margin-top:32px;font-size:12px;color:#94a3b8;">魔法のクリスタルフィギュア</p>
    </div>
  `;
}

export function buildOrderConfirmationEmail(
  orderId: string,
  order: { items: OrderItemDraft[]; estimatedPriceYen: number; customerName: string }
): { subject: string; html: string } {
  const itemRows = order.items
    .map((item) => `<li>${escapeHtml(item.subject)}（${escapeHtml(item.sizeOption)}サイズ）</li>`)
    .join("");

  const html = wrapEmail(`
    <h1 style="font-size:18px;">ご注文ありがとうございます</h1>
    <p>${escapeHtml(order.customerName)} 様</p>
    <p>以下の内容でご注文を承りました。お支払いが確認できましたら製作を開始いたします。</p>
    <ul style="padding-left:20px;">${itemRows}</ul>
    <p style="font-weight:bold;">合計金額：${formatYen(order.estimatedPriceYen)}</p>
    <p style="font-size:13px;color:#64748b;">注文番号：${escapeHtml(orderId)}</p>
  `);

  return { subject: "ご注文ありがとうございます", html };
}

// Appended to every marketing send -- required for opt-in email under Japan's 特定電子メール法.
export function marketingUnsubscribeFooter(unsubscribeUrl: string): string {
  return `
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
      このメールは、ご注文時に配信を希望された方にお送りしています。<br>
      配信停止をご希望の場合は<a href="${unsubscribeUrl}">こちら</a>から手続きできます。
    </p>
  `;
}

export function buildMarketingEmail(
  bodyHtml: string,
  unsubscribeUrl: string
): string {
  return wrapEmail(bodyHtml + marketingUnsubscribeFooter(unsubscribeUrl));
}
