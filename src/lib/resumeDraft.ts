import { loadDraftSlice, saveDraftSlice } from "@/lib/draftStorage";
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

// A one-boolean record kept next to the draft: reading the full draft (uploaded photos, images, cart)
// on every page just to decide whether to show a dot was heavy. Drafts saved before this existed have no
// flag, so the first check falls back to the full read and writes the flag.
export const ORDER_DRAFT_FLAG_KEY = "orderDraftHasContent";

export async function hasResumableDraft(): Promise<boolean> {
  const flag = await loadDraftSlice<boolean>(ORDER_DRAFT_FLAG_KEY);
  if (typeof flag === "boolean") return flag;
  const saved = await loadDraftSlice<SavedOrderDraft>("orderDraft");
  const has = orderDraftHasContent(saved);
  await saveDraftSlice<boolean>(ORDER_DRAFT_FLAG_KEY, has);
  return has;
}

// Fired by draftStorage whenever a slice is saved or cleared, so the header dot updates at once.
export const DRAFT_CHANGED_EVENT = "charo-draft-changed";
