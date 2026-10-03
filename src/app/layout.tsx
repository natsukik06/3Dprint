import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BgmPlayer } from "@/components/BgmPlayer";
import { ReferralCapture } from "@/components/ReferralCapture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUMINA CHARO",
  description: "写真から魔法のカラーで輝くクリスタルフィギュアを作成・注文できるサービス",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ReferralCapture />
        <AuthProvider>{children}</AuthProvider>
        <BgmPlayer />
      </body>
    </html>
  );
}
