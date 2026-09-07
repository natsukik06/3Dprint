"use client";

import { useFormContext, useWatch } from "react-hook-form";
import {
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  SMALL_SIZE_PRICE_YEN,
  calculateEstimate,
  formatYen,
  getTotalQuantity,
} from "@/lib/pricing";
import type { OrderFormValues } from "@/types/order";

export function EstimateSummary() {
  const { control } = useFormContext<OrderFormValues>();
  const [items, generationCreditsUsed] = useWatch({
    control,
    name: ["items", "generationCreditsUsed"],
  });

  const { quantity, subtotalYen, shippingYen, discountYen, totalPriceYen } =
    calculateEstimate({ items, generationCreditsUsed });

  // The undiscounted reference price (every unit at its size's standalone 1st-unit rate) vs. what
  // the set discount actually brings it down to -- makes the quantity discount legible at a
  // glance.
  const listPriceYen = items.reduce((sum, item) => {
    const unitPrice =
      item.sizeOption === "S" ? SMALL_SIZE_PRICE_YEN : FIGURE_PRICE_YEN;
    const hardwarePrice = item.wantsHardware ? HARDWARE_ADDON_PRICE_YEN : 0;
    return sum + (unitPrice + hardwarePrice) * getTotalQuantity(item.colorQuantities);
  }, 0);
  const hasSetDiscount = quantity > 1 && listPriceYen > subtotalYen;
  const yenUntilFreeShipping = Math.max(
    0,
    FREE_SHIPPING_SUBTOTAL_YEN - subtotalYen
  );

  return (
    <div className="rounded-xl bg-slate-800 p-4 text-white">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-300">数量</span>
        <span className="text-sm font-medium tabular-nums text-slate-100">
          {quantity}個
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">小計</span>
        <span className="text-sm font-medium tabular-nums text-slate-100">
          {hasSetDiscount && (
            <span className="mr-1.5 text-slate-500 line-through">
              {formatYen(listPriceYen)}
            </span>
          )}
          {formatYen(subtotalYen)}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">送料</span>
        <span className="text-sm font-medium tabular-nums text-slate-100">
          {shippingYen === 0 ? "無料" : formatYen(shippingYen)}
        </span>
      </div>
      {quantity > 0 && yenUntilFreeShipping > 0 && (
        <p className="mt-1 text-xs text-emerald-300">
          あと{formatYen(yenUntilFreeShipping)}分ご注文いただくと送料無料になります
        </p>
      )}
      {discountYen > 0 && (
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-slate-300">生成クレジット利用割引</span>
          <span className="text-sm font-medium tabular-nums text-emerald-300">
            -{formatYen(discountYen)}
          </span>
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between border-t border-slate-700 pt-2">
        <span className="text-sm text-slate-300">合計金額（税込目安）</span>
        <span className="text-2xl font-bold tabular-nums">
          {formatYen(totalPriceYen)}
        </span>
      </div>
    </div>
  );
}
