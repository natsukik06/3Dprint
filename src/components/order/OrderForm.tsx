"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConsentSection } from "@/components/order/ConsentSection";
import { CustomerInfoForm } from "@/components/order/CustomerInfoForm";
import { DuoBuilder } from "@/components/order/DuoBuilder";
import { EstimateSummary } from "@/components/order/EstimateSummary";
import { PhotoUploader } from "@/components/order/PhotoUploader";
import { PoseSetBuilder } from "@/components/order/PoseSetBuilder";
import { PreviewPanel } from "@/components/order/PreviewPanel";
import { SpecOptions } from "@/components/order/SpecOptions";
import { SubjectPoseFields } from "@/components/order/SubjectPoseFields";
import { SectionCard } from "@/components/ui/SectionCard";
import { signInWithGoogle } from "@/lib/auth";
import { getCustomerProfile, saveCustomerProfile } from "@/lib/customerProfile";
import { clearAllDraftSlices, loadDraftSlice, saveDraftSlice } from "@/lib/draftStorage";
import { colorPriceBySizeMap } from "@/lib/colorSettings";
import { auth } from "@/lib/firebase";
import { submitOrder } from "@/lib/orders";
import { MAGIC_COLOR_LABELS, POSE_LABELS } from "@/lib/pricing";
import { useColorSettings } from "@/lib/useColorSettings";
import {
  HARDWARE_COLOR_LABELS,
  MAX_CART_ITEMS,
  orderFormSchema,
  SIZE_LABELS,
  type MagicColor,
  type OrderFormValues,
  type OrderItemDraft,
  type Pose,
} from "@/types/order";

type ItemDraftSnapshot = Pick<
  OrderFormValues,
  | "subjectType"
  | "subject"
  | "furColorNote"
  | "breedNote"
  | "accessoryNote"
  | "bodyFeatureNote"
  | "pose"
  | "modelStyle"
  | "wantsSelfStanding"
  | "sizeOption"
  | "colorQuantities"
  | "wantsHardware"
  | "hardwareColor"
  | "chainPositionNote"
  | "initial"
  | "wantsEngraving"
  | "engravingText"
  | "engravingFont"
>;

// Snapshot of everything OrderForm needs to fully restore itself after a page reload/navigation --
// saved to IndexedDB (see src/lib/draftStorage.ts) on every change and reloaded on mount. Covers
// the shared RHF fields (photos included -- File objects survive IndexedDB's structured clone)
// plus every local useState that represents in-progress work, not just transient UI state
// (submitState/draftKey/addedFlash are intentionally excluded, see the restore effect below).
export type SavedOrderDraft = {
  formValues: OrderFormValues;
  currentStep: number;
  modelSource: "reuse" | "create";
  createMode: "ai" | "custom" | "duo" | "poseset" | null;
  mountedCreateMode: "ai" | "custom" | "duo" | "poseset" | null;
  generatedModelUrl: string | null;
  generatedPreviewUrls: Partial<Record<MagicColor, string>>;
  generatedReferenceImageUrls: string[];
  isCustomModel: boolean;
  cartOpen: boolean;
};

const DRAFT_DEFAULTS = {
  photos: [] as File[],
  subjectType: "pet" as const,
  subject: "",
  furColorNote: "",
  breedNote: "",
  accessoryNote: "",
  bodyFeatureNote: "",
  pose: "auto" as const,
  modelStyle: "deformed" as const,
  wantsSelfStanding: false,
  sizeOption: "solid30" as const,
  colorQuantities: {
    starryBlue: 0,
    nebulaPink: 0,
    clearAurora: 0,
    galaxyGreen: 0,
    cometOrange: 0,
    cosmicPurple: 0,
    marsRed: 0,
    furCavity: 0,
    pureClear: 1,
    smokeOnyx: 0,
    stardustBlack: 0,
    pureBlack: 0,
    pureWhite: 0,
    clearBlue: 0,
    clearRed: 0,
    clearYellow: 0,
    clearPink: 0,
    clearGreen: 0,
    clearPurple: 0,
    clearOrange: 0,
    frosted: 0,
  },
  wantsHardware: false,
  hardwareColor: "silver" as const,
  chainPositionNote: "",
  initial: "A" as const,
  wantsEngraving: false,
  engravingText: "",
  engravingFont: "Arial" as const,
};

// Just the checkout tail now -- model pick + spec + add-to-cart all live on one "商品" page
// (see currentStep 1 below), reached via a persistent cart button instead of a linear wizard.
const STEP_LABELS = ["商品", "見積", "情報", "確認"];
const TOTAL_STEPS = STEP_LABELS.length;

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-1">
      <p className="mb-2 text-center text-xs font-medium text-slate-500">
        ステップ {current} / {TOTAL_STEPS}：{STEP_LABELS[current - 1]}
      </p>
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          return (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step <= current ? "bg-slate-800" : "bg-slate-200"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "次へ",
  nextDisabled,
  hideBack,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      {!hideBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          戻る
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CartItemCard({
  item,
  onRemove,
}: {
  item: OrderItemDraft;
  onRemove: () => void;
}) {
  // A finished-color render is the best preview when it exists, but not every item has one (e.g.
  // Charo has no color completions generated yet) -- the actual GLB is always there, so fall back
  // to a live, rotatable 3D view rather than leaving the thumbnail blank.
  const thumbnailUrl = Object.values(item.finishedPreviewUrls).find(Boolean);
  const colorSummary = Object.entries(item.colorQuantities)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([color, qty]) => `${MAGIC_COLOR_LABELS[color as MagicColor]}×${qty}`)
    .join(" / ");

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={item.subject}
            className="h-full w-full object-cover"
          />
        ) : item.modelUrl ? (
          <model-viewer
            src={item.modelUrl}
            alt={item.subject}
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.subject}</p>
            <p className="mt-0.5 flex flex-wrap gap-1">
              <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
                {/* Just the size name (e.g. "小サイズ") -- the full label with dimensions/
                shipping method is too long for this badge; that detail is already shown at the
                spec step. */}
                {SIZE_LABELS[item.sizeOption].split("（")[0]}
              </span>
              <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">
                {item.initial}
              </span>
            </p>
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
        <p className="text-xs text-slate-600">{colorSummary}</p>
        {item.wantsHardware && (
          <p className="text-xs text-slate-500">
            金具穴：{HARDWARE_COLOR_LABELS[item.hardwareColor]}
          </p>
        )}
        {item.wantsEngraving && (
          <p className="text-xs text-slate-500">
            刻印：「{item.engravingText}」（{item.engravingFont}）
          </p>
        )}
      </div>
    </div>
  );
}

export function OrderForm() {
  const { settings: colorSettings } = useColorSettings();
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
      requestNote: "",
      agreeCopyright: undefined,
      agreeRisk: undefined,
      agreeAiAccuracy: undefined,
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
    trigger,
    formState: { errors, isSubmitting },
  } = methods;

  const [currentStep, setCurrentStep] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  function goToStep(step: number) {
    setCurrentStep(step);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { user } = useAuth();

  // Cart items without a finished-color render fall back to a live <model-viewer> (see
  // CartItemCard) -- registering the custom element here too means it's ready even if the cart
  // is opened before PreviewPanel (which also imports this) has mounted.
  useEffect(() => {
    import("@google/model-viewer");
  }, []);

  // Account-linked 注文者情報 -- pre-fills the customer-info step from whatever this signed-in
  // customer saved on a past order (or in /mypage's 設定), instead of asking for it every time.
  // Only fills fields still at their blank default, so it never clobbers something already typed
  // this session (e.g. a guest who started filling the form before signing in partway through).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const profile = await getCustomerProfile(user.uid).catch(() => null);
      if (cancelled || !profile) return;
      const current = getValues();
      if (profile.customerName && !current.customerName) {
        setValue("customerName", profile.customerName);
      }
      if (profile.postalCode && !current.postalCode) {
        setValue("postalCode", profile.postalCode);
      }
      if (profile.address && !current.address) {
        setValue("address", profile.address);
      }
      if (profile.phoneNumber && !current.phoneNumber) {
        setValue("phoneNumber", profile.phoneNumber);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getValues, setValue]);

  const [
    photos,
    subjectType,
    subject,
    pose,
    modelStyle,
    wantsSelfStanding,
    colorQuantities,
    furColorNote,
    breedNote,
    accessoryNote,
    bodyFeatureNote,
  ] = useWatch({
    control,
    name: [
      "photos",
      "subjectType",
      "subject",
      "pose",
      "modelStyle",
      "wantsSelfStanding",
      "colorQuantities",
      "furColorNote",
      "breedNote",
      "accessoryNote",
      "bodyFeatureNote",
    ],
  });

  // Which model this draft item is built from: "reuse" covers the always-available Charo
  // mascot plus the customer's own past models (PreviewPanel's own picker, see mode="reuse");
  // "create" branches out to generating/uploading a brand-new one. Defaults to "reuse" so a
  // model (Charo) is already selected the moment the page loads -- no empty state to click
  // through first.
  const [modelSource, setModelSource] = useState<"reuse" | "create">("reuse");
  const [createMode, setCreateMode] = useState<"ai" | "custom" | "duo" | "poseset" | null>(null);
  // Sticky version of createMode -- stays set to the last-chosen creation method so that
  // panel/DuoBuilder instance can be kept mounted (just hidden) while the customer toggles
  // createMode back to the chooser and returns, instead of losing generation progress. Only
  // changes (and swaps out the previous instance) when a genuinely different method is chosen.
  const [mountedCreateMode, setMountedCreateMode] = useState<
    "ai" | "custom" | "duo" | "poseset" | null
  >(null);

  function chooseCreateMode(next: "ai" | "custom" | "duo" | "poseset") {
    setCreateMode(next);
    setMountedCreateMode(next);
  }

  // Snapshot of the item just added to the set, captured right before handleAddToCart resets the
  // draft builder -- lets the two "続けて追加" shortcuts below skip re-entering whatever the next
  // item in a set would obviously share with the previous one (see handleAddSamePetNewPose /
  // handleAddDifferentPetSamePose).
  const [lastItem, setLastItem] = useState<{
    photos: File[];
    draft: ItemDraftSnapshot;
  } | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [generatedPreviewUrls, setGeneratedPreviewUrls] = useState<
    Partial<Record<MagicColor, string>>
  >({});
  const [generatedReferenceImageUrls, setGeneratedReferenceImageUrls] = useState<
    string[]
  >([]);
  const [isCustomModel, setIsCustomModel] = useState(false);
  // Bumped every time an item is added to the set, forced into PreviewPanel's `key` so it fully
  // remounts (clearing its internal 3D-generation state) when starting the next item.
  const [draftKey, setDraftKey] = useState(0);
  const [submitState, setSubmitState] = useState<
    { status: "idle" } | { status: "redirecting" } | { status: "error"; message: string }
  >({ status: "idle" });
  const [cartOpen, setCartOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);

  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");

  // Restore the whole in-progress draft (photos, inputs, cart, and where in the wizard the
  // customer was) from IndexedDB on first mount -- see src/lib/draftStorage.ts. Runs once; a
  // successful checkout clears the saved draft below instead of restoring into it.
  useEffect(() => {
    if (checkoutResult) return;
    let cancelled = false;
    (async () => {
      const saved = await loadDraftSlice<SavedOrderDraft>("orderDraft");
      if (cancelled || !saved) return;
      methods.reset(saved.formValues);
      setCurrentStep(saved.currentStep);
      setModelSource(saved.modelSource);
      setCreateMode(saved.createMode);
      setMountedCreateMode(saved.mountedCreateMode);
      setGeneratedModelUrl(saved.generatedModelUrl);
      setGeneratedPreviewUrls(saved.generatedPreviewUrls);
      setGeneratedReferenceImageUrls(saved.generatedReferenceImageUrls);
      setIsCustomModel(saved.isCustomModel);
      setCartOpen(saved.cartOpen);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and keep saving it back on every change (debounced), form fields included -- methods.watch
  // fires for any RHF field change without needing to enumerate every single one.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function scheduleSave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        saveDraftSlice<SavedOrderDraft>("orderDraft", {
          formValues: methods.getValues(),
          currentStep,
          modelSource,
          createMode,
          mountedCreateMode,
          generatedModelUrl,
          generatedPreviewUrls,
          generatedReferenceImageUrls,
          isCustomModel,
          cartOpen,
        });
      }, 500);
    }
    const subscription = methods.watch(scheduleSave);
    scheduleSave();
    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [
    methods,
    currentStep,
    modelSource,
    createMode,
    mountedCreateMode,
    generatedModelUrl,
    generatedPreviewUrls,
    generatedReferenceImageUrls,
    isCustomModel,
    cartOpen,
  ]);

  // A completed order has nothing left to restore -- clear the saved draft (this and every child
  // component's own slice, see clearAllDraftSlices) so the next visit starts fresh instead of
  // resurrecting a finished order.
  useEffect(() => {
    if (checkoutResult === "success") {
      clearAllDraftSlices();
    }
  }, [checkoutResult]);

  function handlePhotosChange(next: File[]) {
    setValue("photos", next, { shouldValidate: true });
  }

  function handleGenerated(
    result: {
      modelUrl: string;
      finishedPreviewUrls: Partial<Record<MagicColor, string>>;
      referenceImageUrls: string[];
      isCustomModel?: boolean;
      isReselect?: boolean;
    } | null
  ) {
    setGeneratedModelUrl(result?.modelUrl ?? null);
    setGeneratedPreviewUrls(result?.finishedPreviewUrls ?? {});
    setGeneratedReferenceImageUrls(result?.referenceImageUrls ?? []);
    setIsCustomModel(result?.isCustomModel ?? false);
    // A customer-uploaded model doesn't spend an AI generation credit, and picking an
    // already-existing model (Charo, or a past generation) doesn't either -- only a genuinely
    // new AI generation should count toward the credit-usage discount.
    if (result && !result.isCustomModel && !result.isReselect) {
      setValue("generationCreditsUsed", getValues("generationCreditsUsed") + 1);
    }
  }

  function resetDraftBuilder() {
    setValue("photos", DRAFT_DEFAULTS.photos);
    setValue("subjectType", DRAFT_DEFAULTS.subjectType);
    setValue("subject", DRAFT_DEFAULTS.subject);
    setValue("furColorNote", DRAFT_DEFAULTS.furColorNote);
    setValue("breedNote", DRAFT_DEFAULTS.breedNote);
    setValue("accessoryNote", DRAFT_DEFAULTS.accessoryNote);
    setValue("bodyFeatureNote", DRAFT_DEFAULTS.bodyFeatureNote);
    setValue("pose", DRAFT_DEFAULTS.pose);
    setValue("modelStyle", DRAFT_DEFAULTS.modelStyle);
    setValue("wantsSelfStanding", DRAFT_DEFAULTS.wantsSelfStanding);
    setValue("sizeOption", DRAFT_DEFAULTS.sizeOption);
    setValue("colorQuantities", DRAFT_DEFAULTS.colorQuantities);
    setValue("wantsHardware", DRAFT_DEFAULTS.wantsHardware);
    setValue("hardwareColor", DRAFT_DEFAULTS.hardwareColor);
    setValue("chainPositionNote", DRAFT_DEFAULTS.chainPositionNote);
    setValue("initial", DRAFT_DEFAULTS.initial);
    setValue("wantsEngraving", DRAFT_DEFAULTS.wantsEngraving);
    setValue("engravingText", DRAFT_DEFAULTS.engravingText);
    setValue("engravingFont", DRAFT_DEFAULTS.engravingFont);
    setGeneratedModelUrl(null);
    setGeneratedPreviewUrls({});
    setGeneratedReferenceImageUrls([]);
    setIsCustomModel(false);
    setModelSource("reuse");
    setCreateMode(null);
    setMountedCreateMode(null);
    // Clears every child builder's own saved slice (previewDraft/duoDraft/poseSetDraft) too --
    // draftKey bumping below remounts them fresh, and without this their mount-time restore
    // effect would pull back the PREVIOUS item's now-irrelevant in-progress generation state.
    clearAllDraftSlices();
    setDraftKey((k) => k + 1);
  }

  function handleAddToCart() {
    if (!generatedModelUrl || fields.length >= MAX_CART_ITEMS) return;
    const draft = getValues();

    setLastItem({
      photos: draft.photos,
      draft: {
        subjectType: draft.subjectType,
        subject: draft.subject,
        furColorNote: draft.furColorNote,
        breedNote: draft.breedNote,
        accessoryNote: draft.accessoryNote,
        bodyFeatureNote: draft.bodyFeatureNote,
        pose: draft.pose,
        modelStyle: draft.modelStyle,
        wantsSelfStanding: draft.wantsSelfStanding,
        sizeOption: draft.sizeOption,
        colorQuantities: draft.colorQuantities,
        wantsHardware: draft.wantsHardware,
        hardwareColor: draft.hardwareColor,
        chainPositionNote: draft.chainPositionNote,
        initial: draft.initial,
        wantsEngraving: draft.wantsEngraving,
        engravingText: draft.engravingText,
        engravingFont: draft.engravingFont,
      },
    });

    append({
      subjectType: draft.subjectType,
      subject: draft.subject,
      furColorNote: draft.furColorNote,
      breedNote: draft.breedNote,
      accessoryNote: draft.accessoryNote,
      bodyFeatureNote: draft.bodyFeatureNote,
      pose: draft.pose,
      modelStyle: draft.modelStyle,
      wantsSelfStanding: draft.wantsSelfStanding,
      sizeOption: draft.sizeOption,
      colorQuantities: draft.colorQuantities,
      wantsHardware: draft.wantsHardware,
      hardwareColor: draft.wantsHardware ? draft.hardwareColor : DRAFT_DEFAULTS.hardwareColor,
      chainPositionNote: draft.wantsHardware ? draft.chainPositionNote : "",
      initial: draft.initial,
      wantsEngraving: draft.wantsEngraving,
      engravingText: draft.wantsEngraving ? draft.engravingText : "",
      engravingFont: draft.engravingFont,
      referenceImageUrls: generatedReferenceImageUrls,
      modelUrl: generatedModelUrl,
      finishedPreviewUrls: generatedPreviewUrls,
      isCustomModel,
    });

    // generationCreditsUsed is intentionally NOT reset here -- it accumulates across the whole
    // set for the credit-usage discount.
    resetDraftBuilder();
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2200);
  }

  // PoseSetBuilder calls this once per selected pose as its model finishes (independently, in
  // parallel) -- unlike handleAddToCart, there's no single "generated model" to review first, so
  // each pose is appended straight to the cart as its own item, sharing whatever size/color/
  // hardware/engraving the draft form is currently set to. The draft is NOT reset in between (all
  // selected poses share the same in-progress draft), only once every pose has finished/errored.
  function handlePoseSetItemGenerated(
    pose: Pose,
    result: { modelUrl: string; referenceImageUrls: string[] }
  ) {
    if (fields.length >= MAX_CART_ITEMS) return;
    const draft = getValues();

    append({
      subjectType: draft.subjectType,
      subject: `${draft.subject}（${POSE_LABELS[pose]}）`,
      furColorNote: draft.furColorNote,
      breedNote: draft.breedNote,
      accessoryNote: draft.accessoryNote,
      bodyFeatureNote: draft.bodyFeatureNote,
      pose,
      modelStyle: draft.modelStyle,
      wantsSelfStanding: draft.wantsSelfStanding,
      sizeOption: draft.sizeOption,
      colorQuantities: draft.colorQuantities,
      wantsHardware: draft.wantsHardware,
      hardwareColor: draft.wantsHardware ? draft.hardwareColor : DRAFT_DEFAULTS.hardwareColor,
      chainPositionNote: draft.wantsHardware ? draft.chainPositionNote : "",
      initial: draft.initial,
      wantsEngraving: draft.wantsEngraving,
      engravingText: draft.wantsEngraving ? draft.engravingText : "",
      engravingFont: draft.engravingFont,
      referenceImageUrls: result.referenceImageUrls,
      modelUrl: result.modelUrl,
      finishedPreviewUrls: {},
      isCustomModel: false,
    });

    setValue("generationCreditsUsed", getValues("generationCreditsUsed") + 1);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2200);
  }

  function closeCartAndGoTo(step: number) {
    setCartOpen(false);
    goToStep(step);
  }

  // "同じ子で違うポーズ" -- reuses the previous item's photos/subject/details (still the same
  // pet), only the pose (and anything downstream of it, like color/hardware) needs deciding
  // again, so this jumps straight into the AI creation flow with the photo already filled in.
  function handleAddSamePetNewPose() {
    if (!lastItem) return;
    setValue("photos", lastItem.photos, { shouldValidate: true });
    setValue("subjectType", lastItem.draft.subjectType);
    setValue("subject", lastItem.draft.subject);
    setValue("furColorNote", lastItem.draft.furColorNote);
    setValue("breedNote", lastItem.draft.breedNote);
    setValue("accessoryNote", lastItem.draft.accessoryNote);
    setValue("bodyFeatureNote", lastItem.draft.bodyFeatureNote);
    setValue("pose", DRAFT_DEFAULTS.pose);
    setValue("sizeOption", lastItem.draft.sizeOption);
    setValue("colorQuantities", lastItem.draft.colorQuantities);
    setValue("wantsHardware", lastItem.draft.wantsHardware);
    setValue("hardwareColor", lastItem.draft.hardwareColor);
    setValue("initial", lastItem.draft.initial);
    setValue("wantsEngraving", lastItem.draft.wantsEngraving);
    setValue("engravingText", lastItem.draft.engravingText);
    setValue("engravingFont", lastItem.draft.engravingFont);
    setValue("modelStyle", lastItem.draft.modelStyle);
    setValue("wantsSelfStanding", lastItem.draft.wantsSelfStanding);
    setModelSource("create");
    chooseCreateMode("ai");
    setDraftKey((k) => k + 1);
    closeCartAndGoTo(1);
  }

  // "別の子を同じポーズで" -- the opposite split: pose/size/color stay locked to match the
  // previous item for a visually matching set, but it's a different pet, so photo + subject need
  // to be re-entered from scratch.
  function handleAddDifferentPetSamePose() {
    if (!lastItem) return;
    setValue("photos", DRAFT_DEFAULTS.photos);
    setValue("subjectType", lastItem.draft.subjectType);
    setValue("subject", DRAFT_DEFAULTS.subject);
    setValue("furColorNote", DRAFT_DEFAULTS.furColorNote);
    setValue("breedNote", DRAFT_DEFAULTS.breedNote);
    setValue("accessoryNote", DRAFT_DEFAULTS.accessoryNote);
    setValue("bodyFeatureNote", DRAFT_DEFAULTS.bodyFeatureNote);
    setValue("pose", lastItem.draft.pose);
    setValue("modelStyle", lastItem.draft.modelStyle);
    setValue("wantsSelfStanding", lastItem.draft.wantsSelfStanding);
    setValue("sizeOption", lastItem.draft.sizeOption);
    setValue("colorQuantities", lastItem.draft.colorQuantities);
    setValue("wantsHardware", lastItem.draft.wantsHardware);
    setValue("hardwareColor", lastItem.draft.hardwareColor);
    setValue("initial", DRAFT_DEFAULTS.initial);
    // The engraving toggle/font are style choices worth carrying over, but the text itself is
    // pet-specific (usually a name) just like subject/initial above -- reset it, not copy it.
    setValue("wantsEngraving", lastItem.draft.wantsEngraving);
    setValue("engravingText", DRAFT_DEFAULTS.engravingText);
    setValue("engravingFont", lastItem.draft.engravingFont);
    setModelSource("create");
    chooseCreateMode("ai");
    setDraftKey((k) => k + 1);
    closeCartAndGoTo(1);
  }

  function handleProceedToCheckout() {
    if (fields.length === 0 || !user) return;
    closeCartAndGoTo(2);
  }

  async function handleNextFromCustomerInfo() {
    const valid = await trigger([
      "customerName",
      "customerEmail",
      "postalCode",
      "address",
      "phoneNumber",
    ]);
    if (!valid) return;
    goToStep(4);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ status: "idle" });
    if (!auth.currentUser) {
      setSubmitState({ status: "error", message: "ログインが必要です。" });
      return;
    }
    try {
      const orderId = await submitOrder(values, colorPriceBySizeMap(colorSettings));
      setSubmitState({ status: "redirecting" });
      // Best-effort -- saves whatever they just typed back to their account so next time this
      // step is already filled in. Never blocks/fails the order itself if this write fails.
      saveCustomerProfile(auth.currentUser.uid, {
        customerName: values.customerName,
        postalCode: values.postalCode,
        address: values.address,
        phoneNumber: values.phoneNumber,
      }).catch((err) => console.error("saveCustomerProfile failed", err));
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/order-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

  const petDetails = { furColorNote, breedNote, accessoryNote, bodyFeatureNote };

  return (
    <FormProvider {...methods}>
      <div ref={topRef} />

      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="font-serif text-sm font-semibold text-slate-900">LUMINA CHARO</span>
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label="カートを開く"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          <ShoppingCart className="h-4.5 w-4.5" />
          {fields.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {fields.length}
            </span>
          )}
        </button>
      </div>

      <StepProgress current={currentStep} />
      <form onSubmit={onSubmit} className="space-y-4">
        {currentStep === 1 && (
          <SectionCard
            step={1}
            title="キーホルダーフィギュア"
            description="モデルを選び、サイズ・カラーなどを決めてカートに追加してください"
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">モデルを選ぶ</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModelSource("reuse")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    modelSource === "reuse"
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  ちゃろ・過去のモデルから選ぶ
                </button>
                <button
                  type="button"
                  onClick={() => setModelSource("create")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    modelSource === "create"
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  自分オリジナルモデルを作成する
                </button>
              </div>

              <div className={modelSource === "reuse" ? undefined : "hidden"}>
                <PreviewPanel
                  key={draftKey}
                  mode="reuse"
                  photos={[]}
                  subject={subject ?? ""}
                  subjectType={subjectType ?? "pet"}
                  pose={pose}
                  modelStyle={modelStyle}
                  wantsSelfStanding={wantsSelfStanding}
                  colorQuantities={colorQuantities}
                  petDetails={petDetails}
                  initialModel={null}
                  onGenerated={handleGenerated}
                />
              </div>

              {modelSource === "create" && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className={createMode === null ? undefined : "hidden"}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => chooseCreateMode("ai")}
                        className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 bg-white p-4 text-center transition-colors hover:border-slate-500 hover:bg-slate-50"
                      >
                        <Sparkles className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-slate-900">
                          写真からAIで作る
                        </span>
                        <span className="text-xs text-slate-500">
                          ペットや思い出の品の写真をアップロードして、AIに3Dモデルを生成してもらいます
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseCreateMode("duo")}
                        className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 bg-white p-4 text-center transition-colors hover:border-slate-500 hover:bg-slate-50"
                      >
                        <Users className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-slate-900">
                          おそろいセット（2匹一緒に）
                        </span>
                        <span className="text-xs text-slate-500">
                          2匹の写真から、1つのフィギュアに並べて製作します
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseCreateMode("poseset")}
                        className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 bg-white p-4 text-center transition-colors hover:border-slate-500 hover:bg-slate-50"
                      >
                        <LayoutGrid className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-slate-900">
                          5ポーズセットで作る
                        </span>
                        <span className="text-xs text-slate-500">
                          同じ子を5つのポーズでまとめて生成し、好きなポーズだけ選んでモデル化します
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseCreateMode("custom")}
                        className="flex flex-col items-center gap-2 rounded-xl border border-slate-300 bg-white p-4 text-center transition-colors hover:border-slate-500 hover:bg-slate-50"
                      >
                        <Upload className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-slate-900">
                          自分の3Dモデルを持ち込む
                        </span>
                        <span className="text-xs text-slate-500">
                          お手持ちの3Dモデル（GLB形式）をアップロードして製作します
                        </span>
                      </button>
                    </div>
                  </div>

                  {mountedCreateMode === "ai" && (
                    <div className={`space-y-3 ${createMode === "ai" ? "" : "hidden"}`}>
                      <button
                        type="button"
                        onClick={() => setCreateMode(null)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        戻る
                      </button>
                      <PhotoUploader
                        photos={photos ?? []}
                        onChange={handlePhotosChange}
                        error={errors.photos?.message}
                      />
                      <SubjectPoseFields />
                      <PreviewPanel
                        key={draftKey}
                        mode="ai"
                        photos={photos ?? []}
                        subject={subject ?? ""}
                        subjectType={subjectType ?? "pet"}
                        pose={pose}
                        modelStyle={modelStyle}
                        wantsSelfStanding={wantsSelfStanding}
                        colorQuantities={colorQuantities}
                        petDetails={petDetails}
                        onGenerated={handleGenerated}
                      />
                    </div>
                  )}

                  {mountedCreateMode === "custom" && (
                    <div className={`space-y-3 ${createMode === "custom" ? "" : "hidden"}`}>
                      <button
                        type="button"
                        onClick={() => setCreateMode(null)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        戻る
                      </button>
                      <SubjectPoseFields />
                      <PreviewPanel
                        key={draftKey}
                        mode="custom"
                        photos={[]}
                        subject={subject ?? ""}
                        subjectType={subjectType ?? "pet"}
                        pose={pose}
                        modelStyle={modelStyle}
                        wantsSelfStanding={wantsSelfStanding}
                        colorQuantities={colorQuantities}
                        petDetails={petDetails}
                        onGenerated={handleGenerated}
                      />
                    </div>
                  )}

                  {mountedCreateMode === "duo" && (
                    <div className={`space-y-3 ${createMode === "duo" ? "" : "hidden"}`}>
                      <button
                        type="button"
                        onClick={() => setCreateMode(null)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        戻る
                      </button>
                      <DuoBuilder
                        key={draftKey}
                        colorQuantities={colorQuantities}
                        onGenerated={handleGenerated}
                      />
                    </div>
                  )}

                  {mountedCreateMode === "poseset" && (
                    <div className={`space-y-3 ${createMode === "poseset" ? "" : "hidden"}`}>
                      <button
                        type="button"
                        onClick={() => setCreateMode(null)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        戻る
                      </button>
                      <PhotoUploader
                        photos={photos ?? []}
                        onChange={handlePhotosChange}
                        error={errors.photos?.message}
                      />
                      <SubjectPoseFields hideModelOptions />
                      <PoseSetBuilder
                        key={draftKey}
                        photos={photos ?? []}
                        subject={subject ?? ""}
                        subjectType={subjectType ?? "pet"}
                        petDetails={petDetails}
                        onGeneratedItem={handlePoseSetItemGenerated}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <SpecOptions hideSubjectAndPose />
            </div>

            {createMode !== "poseset" && (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!generatedModelUrl || fields.length >= MAX_CART_ITEMS}
                className="mt-4 w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fields.length >= MAX_CART_ITEMS
                  ? `セットは最大${MAX_CART_ITEMS}点までです`
                  : "この内容をカートに追加"}
              </button>
            )}
            {createMode === "poseset" && (
              <p className="mt-4 text-center text-xs text-slate-500">
                モデル化が完了したポーズは自動でカートに追加されます
              </p>
            )}
            {addedFlash && (
              <p className="mt-2 text-center text-sm text-emerald-600">
                ✓ カートに追加しました
              </p>
            )}
          </SectionCard>
        )}

        {currentStep === 2 && (
          <SectionCard step={2} title="お見積もり">
            <EstimateSummary />
            <StepNav onBack={() => goToStep(1)} onNext={() => goToStep(3)} />
          </SectionCard>
        )}

        {currentStep === 3 && (
          <SectionCard step={3} title="注文者情報">
            {user && (
              <p className="mb-3 text-xs text-slate-500">
                次回から自動で入力されるよう、この内容をアカウントに保存します（マイページの設定からいつでも変更できます）
              </p>
            )}
            <CustomerInfoForm />
            <StepNav onBack={() => goToStep(2)} onNext={handleNextFromCustomerInfo} />
          </SectionCard>
        )}

        {currentStep === 4 && (
          <SectionCard step={4} title="利用規約・免責事項">
            <ConsentSection />

            {submitState.status === "error" && (
              <p className="mt-3 text-center text-sm text-red-600">
                {submitState.message}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                戻る
              </button>
              <button
                type="submit"
                disabled={isSubmitting || fields.length === 0}
                className="flex-1 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitState.status === "redirecting"
                  ? "決済ページに移動しています..."
                  : isSubmitting
                    ? "送信中..."
                    : "このセットで注文する（決済へ進む）"}
              </button>
            </div>
          </SectionCard>
        )}
      </form>

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                カート（{fields.length}点）
              </h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="閉じる"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                まだ何も追加されていません
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {fields.map((field, index) => (
                  <CartItemCard
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

            {lastItem && fields.length < MAX_CART_ITEMS && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAddSamePetNewPose}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    同じ子で違うポーズ
                  </span>
                  写真の再アップロード不要
                </button>
                <button
                  type="button"
                  onClick={handleAddDifferentPetSamePose}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    別の子を同じポーズで
                  </span>
                  おそろいのセットに
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => closeCartAndGoTo(1)}
              disabled={fields.length >= MAX_CART_ITEMS}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              新しく追加する
            </button>

            <div className="mt-4 border-t border-slate-100 pt-4">
              {user ? (
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={fields.length === 0}
                  className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  レジに進む
                </button>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-xs text-slate-500">
                    ご注文にはログインが必要です
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                        // Proceeds straight to checkout on success instead of leaving the
                        // customer to notice the button changed and click a second time.
                        if (fields.length > 0) closeCartAndGoTo(2);
                      } catch (err) {
                        console.error("login failed", err);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Googleでログインしてレジに進む
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </FormProvider>
  );
}
