import { loadDraftSlice } from "@/lib/draftStorage";
import type { SavedOrderDraft } from "@/components/order/OrderForm";

// Every /order visit saves *something* (even an untouched default draft), so "there is something to
// resume" has to mean the draft actually holds work: cart items, uploaded photos, a finished model
// or a chosen creation mode. Shared by the 続きから card on /mypage and the red dot on its header link.
export function orderDraftHasContent(draft: SavedOrderDraft | null | undefined): boolean {
  if (!draft) return false;
  return (
    (draft.formValues?.items?.length ?? 0) > 0 ||
    (draft.formValues?.photos?.length ?? 0) > 0 ||
    draft.generatedModelUrl !== null ||
    draft.createMode !== null
  );
}

export async function hasResumableDraft(): Promise<boolean> {
  const saved = await loadDraftSlice<SavedOrderDraft>("orderDraft");
  return orderDraftHasContent(saved);
}

// Fired by draftStorage whenever a slice is saved or cleared, so the header dot updates at once.
export const DRAFT_CHANGED_EVENT = "charo-draft-changed";
