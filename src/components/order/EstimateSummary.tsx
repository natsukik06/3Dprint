"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { calculateEstimate, formatYen } from "@/lib/pricing";
import type { OrderFormValues } from "@/types/order";

export function EstimateSummary() {
  const { control } = useFormContext<OrderFormValues>();
  const [colorQuantities, generationCreditsUsed] = useWatch({
    control,
    name: ["colorQuantities", "generationCreditsUsed"],
  });

  const { quantity, subtotalYen, shippingYen, discountYen, totalPriceYen } =
    calculateEstimate({ colorQuantities, generationCreditsUsed });

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
          {formatYen(subtotalYen)}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">送料</span>
        <span className="text-sm font-medium tabular-nums text-slate-100">
          {shippingYen === 0 ? "無料" : formatYen(shippingYen)}
        </span>
      </div>
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
