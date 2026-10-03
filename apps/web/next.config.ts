import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@krakow-bez-barier/contracts", "@krakow-bez-barier/ui"],
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
