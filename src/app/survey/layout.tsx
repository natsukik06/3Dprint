import type { Metadata } from "next";

// The survey is reached from the QR sticker in the parcel -- keep it out of search results.
export const metadata: Metadata = {
  title: "ご利用アンケート",
  robots: { index: false, follow: false },
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
