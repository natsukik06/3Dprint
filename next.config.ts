import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The shop's own Firebase Storage images (sample renders, premade figures) are served through the Next
    // image optimizer (resized + WebP) instead of as 300KB+ PNGs -- see src/lib/imageUrl.ts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/diy-figure-app.firebasestorage.app/o/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
