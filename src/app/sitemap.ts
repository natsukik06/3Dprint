import type { MetadataRoute } from "next";

const BASE = "https://diy-figure-app.vercel.app";
const PATHS = [
  "/",
  "/products",
  "/order",
  "/story",
  "/examples",
  "/guide/faq",
  "/guide/photo-tips",
  "/legal/tokushoho",
  "/legal/returns",
  "/legal/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${BASE}${path}`, lastModified: new Date() }));
}
