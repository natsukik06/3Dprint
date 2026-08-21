"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ConsentSection } from "@/components/order/ConsentSection";
import { CustomerInfoForm } from "@/components/order/CustomerInfoForm";
import { EstimateSummary } from "@/components/order/EstimateSummary";
import { PhotoUploader } from "@/components/order/PhotoUploader";
import { PreviewPanel } from "@/components/order/PreviewPanel";
import { SpecOptions } from "@/components/order/SpecOptions";
import { SectionCard } from "@/components/ui/SectionCard";
import { submitOrder } from "@/lib/orders";
import { MAGIC_COLOR_LABELS } from "@/lib/pricing";
import {
  DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
  MAX_CART_ITEMS,
  orderFormSchema,
  type MagicColor,
  type OrderFormValues,
  type OrderItemDraft,
} from "@/types/order";

const DRAFT_DEFAULTS = {
  photos: [] as File[],
  subject: "",
  furColorNote: "",
  breedNote: "",
  accessoryNote: "",
  bodyFeatureNote: "",
  pose: "auto" as const,
  sizeOption: "S" as const,
  colorQuantities: {
    starryBlue: 1,
    galaxyGreen: 0,
    clearAurora: 0,
    furCavity: 0,
  },
  wantsHardware: false,
  holePosition: null,
  bottomHolePosition: null,
  bottomHoleDiameterMm: DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
};

function CartItemRow({
  item,
  onRemove,
}: {
  item: OrderItemDraft;
  onRemove: () => void;
}) {
  const thumbnailUrl = Object.values(item.finishedPreviewUrls)[0];
  const colorSummary = Object.entries(item.colorQuantities)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as MagicColor]}×${qty}`)
    .join(" / ");

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={item.subject}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {item.subject}
          <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
            {item.sizeOption}
          </span>
        </p>
        <p className="truncate text-xs text-slate-500">{colorSummary}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${item.subject}をセットから削除`}
        className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function OrderForm() {
  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      ...DRAFT_DEFAULTS,
      items: [],
      customerName: "",
      customerEmail: "",
      postalCode: "",
      address: "",
      phoneNumber: "",
      deliveryDate: "",
      deliveryTimeSlot: "none",
      requestNote: "",
      agreeCopyright: undefined,
      agreeRisk: undefined,
      agreeShowcase: false,
      agreeMarketingEmail: false,
      generationCreditsUsed: 0,
    },
  });

  const {
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const [
    photos,
    subject,
    pose,
    colorQuantities,
    furColorNote,
    breedNote,
    accessoryNote,
    bodyFeatureNote,
  ] = useWatch({
    control,
    name: [
      "photos",
      "subject",
      "pose",
      "colorQuantities",
      "furColorNote",
      "breedNote",
      "accessoryNote",
      "bodyFeatureNote",
    ],
  });

  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [generatedPreviewUrls, setGeneratedPreviewUrls] = useState<
    Partial<Record<MagicColor, string>>
  >({});
  const [generatedReferenceImageUrls, setGeneratedReferenceImageUrls] = useState<
    string[]
  >([]);
  // Bumped every time an item is added to the set, forced into PreviewPanel's `key` so it fully
  // remounts (clearing its internal 3D-generation state) when starting the next item.
  const [draftKey, setDraftKey] = useState(0);
  const [submitState, setSubmitState] = useState<
    { status: "idle" } | { status: "redirecting" } | { status: "error"; message: string }
  >({ status: "idle" });

  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");

  function handlePhotosChange(next: File[]) {
    setValue("photos", next, { shouldValidate: true });
  }

  function handleGenerated(
    result: {
      modelUrl: string;
      finishedPreviewUrls: Partial<Record<MagicColor, string>>;
      referenceImageUrls: string[];
    } | null
  ) {
    setGeneratedModelUrl(result?.modelUrl ?? null);
    setGeneratedPreviewUrls(result?.finishedPreviewUrls ?? {});
    setGeneratedReferenceImageUrls(result?.referenceImageUrls ?? []);
    if (result) {
      setValue("generationCreditsUsed", getValues("generationCreditsUsed") + 1);
    }
  }

  function handleAddToCart() {
    if (!generatedModelUrl || fields.length >= MAX_CART_ITEMS) return;
    const draft = getValues();

    append({
      subject: draft.subject,
      furColorNote: draft.furColorNote,
      breedNote: draft.breedNote,
      accessoryNote: draft.accessoryNote,
      bodyFeatureNote: draft.bodyFeatureNote,
      pose: draft.pose,
      sizeOption: draft.sizeOption,
      colorQuantities: draft.colorQuantities,
      wantsHardware: draft.wantsHardware,
      holePosition: draft.wantsHardware ? draft.holePosition : null,
      bottomHolePosition: draft.bottomHolePosition,
      bottomHoleDiameterMm: draft.bottomHoleDiameterMm,
      referenceImageUrls: generatedReferenceImageUrls,
      modelUrl: generatedModelUrl,
      finishedPreviewUrls: generatedPreviewUrls,
    });

    // Reset the draft builder for the next item; generationCreditsUsed is intentionally NOT
    // reset -- it accumulates across the whole set for the credit-usage discount.
    setValue("photos", DRAFT_DEFAULTS.photos);
    setValue("subject", DRAFT_DEFAULTS.subject);
    setValue("furColorNote", DRAFT_DEFAULTS.furColorNote);
    setValue("breedNote", DRAFT_DEFAULTS.breedNote);
    setValue("accessoryNote", DRAFT_DEFAULTS.accessoryNote);
    setValue("bodyFeatureNote", DRAFT_DEFAULTS.bodyFeatureNote);
    setValue("pose", DRAFT_DEFAULTS.pose);
    setValue("sizeOption", DRAFT_DEFAULTS.sizeOption);
    setValue("colorQuantities", DRAFT_DEFAULTS.colorQuantities);
    setValue("wantsHardware", DRAFT_DEFAULTS.wantsHardware);
    setValue("holePosition", DRAFT_DEFAULTS.holePosition);
    setValue("bottomHolePosition", DRAFT_DEFAULTS.bottomHolePosition);
    setValue("bottomHoleDiameterMm", DRAFT_DEFAULTS.bottomHoleDiameterMm);
    setGeneratedModelUrl(null);
    setGeneratedPreviewUrls({});
    setGeneratedReferenceImageUrls([]);
    setDraftKey((k) => k + 1);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ status: "idle" });
    try {
      const orderId = await submitOrder(values);
      setSubmitState({ status: "redirecting" });
      const res = await fetch("/api/order-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "決済ページの作成に失敗しました");
      }
      window.location.assign(json.url as string);
    } catch {
      setSubmitState({
        status: "error",
        message: "送信に失敗しました。時間をおいて再度お試しください。",
      });
    }
  });

  if (checkoutResult === "success") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          ご注文ありがとうございます
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          お支払いが完了しました。ご入力いただいたメールアドレス宛に確認のご連絡をいたします。
        </p>
      </div>
    );
  }

  if (checkoutResult === "cancel") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          お支払いがキャンセルされました
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          お支払いが完了しなかったため、注文は確定していません。お手数ですが、もう一度最初からお試しください。
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="space-y-4">
        <SectionCard
          step={1}
          title="写真のアップロード"
          description="立体化したいものの写真をアップロードしてください"
        >
          <PhotoUploader
            photos={photos ?? []}
            onChange={handlePhotosChange}
            error={errors.photos?.message}
          />
        </SectionCard>

        <SectionCard
          step={2}
          title="作りたいものと仕様"
          description="何を作るか、ポーズ、魔法のカラーを選んでください"
        >
          <SpecOptions />
        </SectionCard>

        <SectionCard
          step={3}
          title="3Dプレビュー"
          description="生成できたら「セットに追加」で確定してください（違うモデル・サイズを続けて追加できます）"
        >
          <PreviewPanel
            key={draftKey}
            photos={photos ?? []}
            subject={subject ?? ""}
            pose={pose}
            colorQuantities={colorQuantities}
            petDetails={{
              furColorNote,
              breedNote,
              accessoryNote,
              bodyFeatureNote,
            }}
            onGenerated={handleGenerated}
          />
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!generatedModelUrl || fields.length >= MAX_CART_ITEMS}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fields.length >= MAX_CART_ITEMS
              ? `セットは最大${MAX_CART_ITEMS}点までです`
              : "この内容をセットに追加"}
          </button>
        </SectionCard>

        <SectionCard
          step={4}
          title="セットの中身"
          description={
            fields.length > 0
              ? `現在${fields.length}点（上のステップで続けて追加できます）`
              : "まだ何も追加されていません（ステップ3で追加してください）"
          }
        >
          {fields.length === 0 ? (
            <p className="text-sm text-slate-400">
              3Dプレビューを生成し「セットに追加」を押すとここに表示されます
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <CartItemRow
                  key={field.id}
                  item={field}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
          )}
          {errors.items && (
            <p className="mt-2 text-sm text-red-600">{errors.items.message}</p>
          )}
        </SectionCard>

        <SectionCard step={5} title="お見積もり">
          <EstimateSummary />
        </SectionCard>

        <SectionCard step={6} title="注文者情報">
          <CustomerInfoForm />
        </SectionCard>

        <SectionCard step={7} title="利用規約・免責事項">
          <ConsentSection />
        </SectionCard>

        {submitState.status === "error" && (
          <p className="text-center text-sm text-red-600">
            {submitState.message}
          </p>
        )}
        {fields.length === 0 && (
          <p className="text-center text-sm text-amber-600">
            先にセットへ1点以上追加してください
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || fields.length === 0}
          className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState.status === "redirecting"
            ? "決済ページに移動しています..."
            : isSubmitting
              ? "送信中..."
              : `このセットで注文する（決済へ進む）`}
        </button>
      </form>
    </FormProvider>
  );
}
