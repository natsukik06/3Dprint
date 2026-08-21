"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { ConsentSection } from "@/components/order/ConsentSection";
import { CustomerInfoForm } from "@/components/order/CustomerInfoForm";
import { EstimateSummary } from "@/components/order/EstimateSummary";
import { PhotoUploader } from "@/components/order/PhotoUploader";
import { PreviewPanel } from "@/components/order/PreviewPanel";
import { SpecOptions } from "@/components/order/SpecOptions";
import { SectionCard } from "@/components/ui/SectionCard";
import { submitOrder } from "@/lib/orders";
import {
  DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
  orderFormSchema,
  type MagicColor,
  type OrderFormValues,
} from "@/types/order";

export function OrderForm() {
  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      photos: [],
      subject: "",
      pose: "auto",
      sizeOption: "S",
      colorQuantities: {
        starryBlue: 1,
        galaxyGreen: 0,
        clearAurora: 0,
        furCavity: 0,
      },
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
      generationCreditsUsed: 0,
      wantsHardware: false,
      holePosition: null,
      bottomHolePosition: null,
      bottomHoleDiameterMm: DEFAULT_BOTTOM_HOLE_DIAMETER_MM,
    },
  });

  const {
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = methods;

  const [photos, subject, pose, colorQuantities] = useWatch({
    control,
    name: ["photos", "subject", "pose", "colorQuantities"],
  });

  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [generatedPreviewUrls, setGeneratedPreviewUrls] = useState<
    Partial<Record<MagicColor, string>>
  >({});
  const [generatedReferenceImageUrls, setGeneratedReferenceImageUrls] = useState<
    string[]
  >([]);
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

  const onSubmit = handleSubmit(async (values) => {
    if (!generatedModelUrl) return;
    setSubmitState({ status: "idle" });
    try {
      const orderId = await submitOrder(
        values,
        generatedModelUrl,
        generatedPreviewUrls,
        generatedReferenceImageUrls
      );
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

        <SectionCard step={3} title="3Dプレビュー">
          <PreviewPanel
            photos={photos ?? []}
            subject={subject ?? ""}
            pose={pose}
            colorQuantities={colorQuantities}
            onGenerated={handleGenerated}
          />
        </SectionCard>

        <SectionCard step={4} title="お見積もり">
          <EstimateSummary />
        </SectionCard>

        <SectionCard step={5} title="注文者情報">
          <CustomerInfoForm />
        </SectionCard>

        <SectionCard step={6} title="利用規約・免責事項">
          <ConsentSection />
        </SectionCard>

        {submitState.status === "error" && (
          <p className="text-center text-sm text-red-600">
            {submitState.message}
          </p>
        )}
        {!generatedModelUrl && (
          <p className="text-center text-sm text-amber-600">
            先に3Dプレビューを生成（またはギャラリーから選択）してください
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !generatedModelUrl}
          className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState.status === "redirecting"
            ? "決済ページに移動しています..."
            : isSubmitting
              ? "送信中..."
              : "この内容で注文する（決済へ進む）"}
        </button>
      </form>
    </FormProvider>
  );
}
