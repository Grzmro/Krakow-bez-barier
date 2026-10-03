import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@krakow-bez-barier/contracts", "@krakow-bez-barier/db", "@krakow-bez-barier/ui"],
  // Versions the service worker cache: each build registers /sw.js?build=<id> and drops older caches.
  env: { NEXT_PUBLIC_SW_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? String(Date.now()) },
  async headers() {
    return [
      {
        // Browsers must always revalidate the service worker so a deploy reaches installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
