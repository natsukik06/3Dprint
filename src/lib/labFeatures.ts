import { ADMIN_EMAIL } from "@/lib/admin";

// 準備中の機能 (the 2-pet おそろいセット and the 5ポーズセット): closed to customers while they are being
// tested. Only the shop owner (the admin account) can still use them, to test on /order (see
// /admin/lab). Set LAB_FEATURES_PUBLIC to true to open them to everyone again -- the order page cards
// and the API routes both read this one flag.
export const LAB_FEATURES_PUBLIC = false;

export function canUseLabFeatures(email: string | null | undefined): boolean {
  return LAB_FEATURES_PUBLIC || email === ADMIN_EMAIL;
}

export const LAB_CLOSED_MESSAGE = "この機能は現在準備中です。公開までもうしばらくお待ちください。";
