import { Zen_Old_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";

// Shared across every top-level marketing page (/, /products, /story) so next/font only loads
// each family once and every page's typography stays pixel-identical.
export const zenMincho = Zen_Old_Mincho({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-zen-mincho",
});

export const zenGothic = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-gothic",
});

export const displayFont = { fontFamily: "var(--font-zen-mincho), serif" };
