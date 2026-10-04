import { formatYen, MAGIC_COLOR_LABELS, REFERRAL_DISCOUNT_RATE } from "@/lib/pricing";
import { HARDWARE_COLOR_LABELS, sizeShortLabel, type MagicColor, type OrderItemDraft } from "@/types/order";

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
      <p style="margin-top:32px;font-size:12px;color:#94a3b8;">Charo 3D</p>
    </div>
  `;
}

// Sent as part of the order confirmation email (not the physical insert -- that ships with the
// product weeks later, far too late to serve as a receipt). Issued at payment-confirmation time,
// which is exactly when buildOrderConfirmationEmail already fires from the Stripe webhook.
// No issuer address on purpose -- kept consistent with the 特定商取引法 page's "開示は請求時のみ"
// stance for the same solo-operator privacy reason; the brand name + email is enough for "who
// issued this" without publishing a home address on every receipt sent out.
function buildReceiptSection(
  orderId: string,
  customerName: string,
  totalPriceYen: number,
  issuedAt: Date
): string {
  const dateLabel = issuedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
    <div style="margin-top:24px;border:1px solid #cbd5e1;border-radius:8px;padding:16px;">
      <h2 style="font-size:15px;margin:0 0 12px;">領収書</h2>
      <p style="margin:4px 0;font-size:13px;color:#64748b;">発行日：${escapeHtml(dateLabel)}</p>
      <p style="margin:4px 0;font-size:14px;">${escapeHtml(customerName)} 様</p>
      <p style="margin:12px 0;font-size:20px;font-weight:bold;">${formatYen(totalPriceYen)}</p>
      <p style="margin:4px 0;font-size:14px;">但し書き：キーホルダー代として</p>
      <p style="margin:4px 0;font-size:13px;color:#64748b;">注文番号：${escapeHtml(orderId)}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:10px;">
        発行者：Charo 3D（natsuki.ko006@gmail.com）
      </p>
    </div>
  `;
}

export function buildOrderConfirmationEmail(
  orderId: string,
  order: { items: OrderItemDraft[]; estimatedPriceYen: number; customerName: string }
): { subject: string; html: string } {
  // Everything the customer chose, so they can catch a mistake (e.g. a misspelled engraving) while
  // there is still time -- color x quantity, strap, engraving.
  const itemRows = order.items
    .map((item) => {
      const colors = Object.entries(item.colorQuantities)
        .filter(([, qty]) => (qty ?? 0) > 0)
        .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as MagicColor]}×${qty}`)
        .join("・");
      const details = [
        colors,
        item.wantsHardware ? `金具穴：${HARDWARE_COLOR_LABELS[item.hardwareColor]}` : "",
        item.wantsEngraving && item.engravingText ? `名前刻印：「${item.engravingText}」` : "",
      ]
        .filter(Boolean)
        .join(" ／ ");
      return `<li>${escapeHtml(item.subject)}（${escapeHtml(sizeShortLabel(item.sizeOption))}サイズ）<br><span style="font-size:13px;color:#475569;">${escapeHtml(details)}</span></li>`;
    })
    .join("");

  const html = wrapEmail(`
    <h1 style="font-size:18px;">ご注文ありがとうございます</h1>
    <p>${escapeHtml(order.customerName)} 様</p>
    <p>以下の内容でご注文を承り、お支払いを確認いたしました。これから製作を進めます。発送の目安は、お支払い完了後 1週間〜1か月ほどです。</p>
    <ul style="padding-left:20px;">${itemRows}</ul>
    <p style="font-size:13px;color:#475569;">内容に間違いがある場合は、製作が始まる前にできるだけお早めに、このメールへの返信または natsuki.ko006@gmail.com までご連絡ください（キャンセルのご相談も同じ宛先です）。</p>
    <p style="font-weight:bold;">合計金額：${formatYen(order.estimatedPriceYen)}</p>
    <p style="font-size:13px;color:#64748b;">注文番号：${escapeHtml(orderId)}</p>
    <p style="font-size:12px;color:#b45309;background:#fffbeb;padding:8px 12px;border-radius:8px;">
      3Dモデルのデータは、商品発送から7日後に自動的に削除されます。保存しておきたい方は、マイページから発送後お早めにダウンロードしてください。
    </p>
    ${buildReceiptSection(orderId, order.customerName, order.estimatedPriceYen, new Date())}
  `);

  return { subject: "ご注文ありがとうございます", html };
}

// Fired once, exactly when an order's `shipped` flag actually flips false->true (see
// /api/admin/orders/[id]/ship) -- not on every admin toggle, so correcting a mis-click never
// re-sends this. referralUrl is null for a guest checkout (no uid captured at submission time),
// in which case the referral block is simply omitted rather than pointing at a broken link.
export function buildShippedNotificationEmail(
  orderId: string,
  order: { customerName: string; items: OrderItemDraft[] },
  referralUrl: string | null
): { subject: string; html: string } {
  const subjectSummary = order.items.map((item) => item.subject).filter(Boolean).join(" / ");
  const referralPercent = Math.round(REFERRAL_DISCOUNT_RATE * 100);

  const referralSection = referralUrl
    ? `
      <div style="margin-top:20px;border:1px solid #cbd5e1;border-radius:8px;padding:16px;">
        <h2 style="font-size:14px;margin:0 0 8px;">お友達紹介</h2>
        <p style="margin:0 0 10px;font-size:13px;color:#475569;">
          このリンクから友達が新規登録すると、お互い次回のご注文が${referralPercent}%オフになります。
        </p>
        <p style="margin:0;font-size:13px;word-break:break-all;">
          <a href="${escapeHtml(referralUrl)}" style="color:#0369a1;">${escapeHtml(referralUrl)}</a>
        </p>
      </div>
    `
    : "";

  const html = wrapEmail(`
    <h1 style="font-size:18px;">発送のお知らせ</h1>
    <p>${escapeHtml(order.customerName)} 様</p>
    <p>ご注文いただいた${subjectSummary ? `「${escapeHtml(subjectSummary)}」` : "商品"}を発送いたしました。到着まで今しばらくお待ちください。</p>
    <p style="font-size:13px;color:#64748b;">注文番号：${escapeHtml(orderId)}</p>
    ${referralSection}
    <p style="margin-top:20px;font-size:13px;color:#64748b;">
      よろしければ、お手元に届いた様子を <a href="https://instagram.com/lumina_charo" style="color:#0369a1;">@lumina_charo</a> をタグ付けしてSNSに投稿していただけると励みになります（任意です）。
    </p>
  `);

  return { subject: "発送のお知らせ", html };
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
