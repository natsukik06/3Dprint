import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  SURVEY_FOUND_OPTIONS,
  SURVEY_MAX_COMMENT_LENGTH,
  SURVEY_REWARD_CREDITS,
  type SurveyAnswers,
} from "@/types/survey";

export { SURVEY_REWARD_CREDITS };

type SubmitResult = { ok: true } | { ok: false; error: string; status: number };

function isInt1to5(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

export function parseSurveyAnswers(raw: unknown): SurveyAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.foundVia !== "string" || !(SURVEY_FOUND_OPTIONS as readonly string[]).includes(r.foundVia)) return null;
  if (!isInt1to5(r.satisfaction) || !isInt1to5(r.likeness)) return null;
  if (r.priceFeel !== "cheap" && r.priceFeel !== "fair" && r.priceFeel !== "expensive") return null;
  if (typeof r.wouldRecommend !== "boolean" || typeof r.allowQuote !== "boolean") return null;
  const comment = typeof r.comment === "string" ? r.comment.trim() : "";
  if (comment.length > SURVEY_MAX_COMMENT_LENGTH) return null;
  return {
    foundVia: r.foundVia,
    satisfaction: r.satisfaction,
    likeness: r.likeness,
    priceFeel: r.priceFeel,
    wouldRecommend: r.wouldRecommend,
    comment,
    allowQuote: r.allowQuote,
  };
}

// The QR sticker is a public URL, so the reward is gated twice: only accounts whose verified email
// matches a real (paid) order can claim, and each account can claim exactly once (the response doc
// id is the uid, created inside the same transaction that adds the credit).
export async function submitSurvey(
  uid: string,
  email: string | null,
  answers: SurveyAnswers
): Promise<SubmitResult> {
  if (!email) {
    return { ok: false, error: "メールアドレスを確認できませんでした。ログインし直してください", status: 400 };
  }
  const orders = await adminDb.collection("orders").where("customerEmail", "==", email).limit(1).get();
  if (orders.empty) {
    return {
      ok: false,
      error: "ご注文時のメールアドレスのアカウントでログインしてください（ご注文が確認できませんでした）",
      status: 403,
    };
  }

  const responseRef = adminDb.collection("survey_responses").doc(uid);
  const userRef = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (tx): Promise<SubmitResult> => {
    const existing = await tx.get(responseRef);
    if (existing.exists) {
      return { ok: false, error: "アンケートはすでにご回答いただいています。ありがとうございました", status: 409 };
    }
    tx.set(responseRef, {
      ...answers,
      email,
      rewardCredits: SURVEY_REWARD_CREDITS,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      userRef,
      {
        credits: FieldValue.increment(SURVEY_REWARD_CREDITS),
        creditsLastActivityAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  });
}
