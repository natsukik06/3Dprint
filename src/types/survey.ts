// Shared (client + server) survey constants -- kept out of src/lib/survey.ts, which imports the
// Firebase Admin SDK and so can't be bundled into the browser.
export const SURVEY_FOUND_OPTIONS = ["Instagram", "YouTube", "TikTok", "X（旧Twitter）", "友人・知人の紹介", "検索", "その他"] as const;
export const SURVEY_MAX_COMMENT_LENGTH = 500;
export const SURVEY_REWARD_CREDITS = 1;

export type SurveyPriceFeel = "cheap" | "fair" | "expensive";

export type SurveyAnswers = {
  foundVia: string;
  satisfaction: number; // 1-5
  likeness: number; // 1-5: how closely the piece resembles the pet / original
  priceFeel: SurveyPriceFeel;
  wouldRecommend: boolean;
  comment: string;
  allowQuote: boolean; // may the shop quote the comment anonymously on the site / SNS
};

export const SURVEY_PRICE_LABELS: Record<SurveyPriceFeel, string> = {
  cheap: "お手頃だと思う",
  fair: "ちょうどよい",
  expensive: "少し高いと思う",
};
