import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/mypage"] }],
    sitemap: "https://diy-figure-app.vercel.app/sitemap.xml",
  };
}
