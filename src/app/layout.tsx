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

const SITE_URL = "https://diy-figure-app.vercel.app";
const SITE_TITLE = "Charo 3D｜写真から作るオーダーメイド・クリアレジンのキーホルダー";
const SITE_DESCRIPTION =
  "愛犬・愛猫や大切なものの写真から、世界にひとつだけのクリアレジンのキーホルダーを作ります。1個ずつ手作りのオーダーメイド。写真を送るだけで3D形状を確認してから注文できます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s｜Charo 3D" },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Charo 3D",
    locale: "ja_JP",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo-charo3d-v2.png", width: 938, height: 1004, alt: "Charo 3D" }],
  },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION },
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
