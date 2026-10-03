import type { NextConfig } from "next";

const corsRead = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
  { key: "Access-Control-Expose-Headers", value: "X-Data-Attribution, Retry-After" },
];

const dataAttribution = {
  key: "X-Data-Attribution",
  value:
    "Includes data © OpenStreetMap contributors (ODbL 1.0); licence and attribution of every source: GET /api/v1/sources",
};

/**
 * Read-only public API, allowlisted per path so a new write endpoint is closed by default.
 * Data endpoints also carry the attribution header; health, categories and the spec carry only CORS.
 */
export const publicApiRoutes = [
  { source: "/api/v1/places", headers: [...corsRead, dataAttribution] },
  { source: "/api/v1/places/:id", headers: [...corsRead, dataAttribution] },
  { source: "/api/v1/sources", headers: [...corsRead, dataAttribution] },
  { source: "/api/v1/widget/:placeId", headers: [...corsRead, dataAttribution] },
  { source: "/api/v1/categories", headers: corsRead },
  { source: "/api/v1/health", headers: corsRead },
  { source: "/api/openapi.json", headers: corsRead },
];

/** The demo is shared by link only: keep it out of search engines. */
export const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  transpilePackages: ["@krakow-bez-barier/contracts", "@krakow-bez-barier/db", "@krakow-bez-barier/ui"],
  // Versions the service worker cache: each build registers /sw.js?build=<id> and drops older caches.
  env: { NEXT_PUBLIC_SW_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? String(Date.now()) },
  async headers() {
    return [
      ...publicApiRoutes,
      { source: "/:path*", headers: noIndex },
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
