"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { colorPriceBySizeMap } from "@/lib/colorSettings";
import { GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN } from "@/lib/creditPacks";
import { db } from "@/lib/firebase";
import { isPremadeModelUrl } from "@/lib/premadeModels";
import {
  CUSTOM_ORDER_SURCHARGE_YEN,
  ENGRAVING_PRICE_YEN,
  FIGURE_PRICE_YEN,
  FREE_SHIPPING_SUBTOTAL_YEN,
  HARDWARE_ADDON_PRICE_YEN,
  SOLID_PRICE_YEN,
  calculateEstimate,
  formatYen,
  getTotalQuantity,
} from "@/lib/pricing";
import { useColorSettings } from "@/lib/useColorSettings";
import { SOLID_SIZE_OPTIONS, type OrderFormValues, type SolidSizeOption } from "@/types/order";

export function EstimateSummary() {
  const { control } = useFormContext<OrderFormValues>();
  const items = useWatch({ control, name: "items" });

  // Display-only -- the actual discounts are checked and consumed server-side at checkout (see
  // /api/order-checkout), this just keeps the shown total honest beforehand. Both read live from
  // Firestore (not the in-progress cart's own React state) so the estimate stays correct even
  // across a refresh or a gap of days between generating and actually ordering -- see
  // generationCreditsAvailable / addDiscountableCredit in src/lib/credits.ts.
  const { user } = useAuth();
  const { settings: colorSettings } = useColorSettings();
  const [referralDiscountActive, setReferralDiscountActive] = useState(false);
  const [generationCreditsAvailable, setGenerationCreditsAvailable] = useState(0);
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReferralDiscountActive(false);
      setGenerationCreditsAvailable(0);
      return;
    }
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setReferralDiscountActive(snap.data()?.referralDiscountAvailable === true);
      setGenerationCreditsAvailable(
        (snap.data()?.generationCreditsAvailable as number) ?? 0
      );
    });
  }, [user]);

  const {
    quantity,
    subtotalYen,
    shippingYen,
    discountYen,
    referralDiscountYen,
    totalPriceYen,
  } = calculateEstimate({
    items,
    generationCreditsUsed: generationCreditsAvailable,
    referralDiscountActive,
    colorPriceYen: colorPriceBySizeMap(colorSettings),
  });

  // The undiscounted reference price (every unit at its size's standalone 1st-unit rate) vs. what
  // the set discount actually brings it down to -- makes the quantity discount legible at a
  // glance.
  const colorPriceBySize = colorPriceBySizeMap(colorSettings);
  const listPriceYen = items.reduce((sum, item) => {
    const quantity = getTotalQuantity(item.colorQuantities);
    const hardwarePrice = item.wantsHardware ? HARDWARE_ADDON_PRICE_YEN * quantity : 0;
    const engravingPrice = item.wantsEngraving ? ENGRAVING_PRICE_YEN * quantity : 0;
    const colorSurcharge = Object.entries(item.colorQuantities).reduce(
      (colorSum, [color, qty]) =>
        colorSum +
        (colorPriceBySize[color as keyof typeof colorPriceBySize]?.[item.sizeOption] ?? 0) * qty,
      0
    );
    // Solid (中実) sizes are flat-priced with no quantity-discount ladder, so their "list
    // price" is identical to what they actually cost -- only M's ladder ever produces a gap.
    const isSolid = (SOLID_SIZE_OPTIONS as readonly string[]).includes(item.sizeOption);
    const unitPrice = isSolid
      ? SOLID_PRICE_YEN[item.sizeOption as SolidSizeOption]
      : FIGURE_PRICE_YEN;
    const customSurcharge = isPremadeModelUrl(item.modelUrl) ? 0 : CUSTOM_ORDER_SURCHARGE_YEN * quantity;
    return sum + unitPrice * quantity + hardwarePrice + engravingPrice + colorSurcharge + customSurcharge;
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
      {quantity > 0 &&
        generationCreditsAvailable > 0 &&
        subtotalYen < GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN && (
          <p className="mt-1 text-xs text-emerald-300">
            あと{formatYen(GENERATION_FEE_REFUND_MIN_SUBTOTAL_YEN - subtotalYen)}
            分ご注文いただくと、3Dモデル生成代が割引（無料）になります
          </p>
        )}
      {discountYen > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-400/15 px-2.5 py-2 ring-1 ring-emerald-400/40">
          <span className="text-sm font-semibold text-emerald-200">
            ✓ 生成クレジット利用割引
          </span>
          <span className="text-base font-bold tabular-nums text-emerald-300">
            -{formatYen(discountYen)}
          </span>
        </div>
      )}
      {referralDiscountYen > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-400/15 px-2.5 py-2 ring-1 ring-emerald-400/40">
          <span className="text-sm font-semibold text-emerald-200">
            ✓ お友達紹介割引（10%）
          </span>
          <span className="text-base font-bold tabular-nums text-emerald-300">
            -{formatYen(referralDiscountYen)}
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
