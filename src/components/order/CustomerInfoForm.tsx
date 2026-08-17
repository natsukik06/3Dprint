"use client";

import { useFormContext } from "react-hook-form";
import { DELIVERY_TIME_SLOT_LABELS } from "@/lib/pricing";
import { DELIVERY_TIME_SLOT_OPTIONS, type OrderFormValues } from "@/types/order";

export function CustomerInfoForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="customerName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          お名前
        </label>
        <input
          id="customerName"
          type="text"
          autoComplete="name"
          {...register("customerName")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.customerName && (
          <p className="mt-1 text-sm text-red-600">
            {errors.customerName.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="customerEmail"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          メールアドレス
        </label>
        <input
          id="customerEmail"
          type="email"
          autoComplete="email"
          {...register("customerEmail")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.customerEmail && (
          <p className="mt-1 text-sm text-red-600">
            {errors.customerEmail.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="phoneNumber"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          電話番号
        </label>
        <input
          id="phoneNumber"
          type="tel"
          autoComplete="tel"
          {...register("phoneNumber")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.phoneNumber && (
          <p className="mt-1 text-sm text-red-600">
            {errors.phoneNumber.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="postalCode"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          郵便番号
        </label>
        <input
          id="postalCode"
          type="text"
          placeholder="例：123-4567"
          autoComplete="postal-code"
          {...register("postalCode")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.postalCode && (
          <p className="mt-1 text-sm text-red-600">
            {errors.postalCode.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="address"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          配送先住所
        </label>
        <input
          id="address"
          type="text"
          placeholder="都道府県から番地・建物名まで"
          autoComplete="street-address"
          {...register("address")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="deliveryDate"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            お届け希望日（任意）
          </label>
          <input
            id="deliveryDate"
            type="date"
            {...register("deliveryDate")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="deliveryTimeSlot"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            お届け希望時間帯
          </label>
          <select
            id="deliveryTimeSlot"
            {...register("deliveryTimeSlot")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          >
            {DELIVERY_TIME_SLOT_OPTIONS.map((slot) => (
              <option key={slot} value={slot}>
                {DELIVERY_TIME_SLOT_LABELS[slot]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="requestNote"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          ご要望（任意）
        </label>
        <textarea
          id="requestNote"
          rows={3}
          {...register("requestNote")}
          placeholder="仕上げや色味のご希望などがあればご記入ください"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        {errors.requestNote && (
          <p className="mt-1 text-sm text-red-600">
            {errors.requestNote.message}
          </p>
        )}
      </div>
    </div>
  );
}
