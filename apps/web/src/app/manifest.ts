import type { MetadataRoute } from "next";
import { pl } from "@/i18n/pl";
import { brandColors } from "@/lib/pwa/brand-colors";
import { routes } from "@/lib/routes";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: routes.home,
    name: pl.common.app.name,
    short_name: pl.pwa.shortName,
    description: pl.common.app.description,
    lang: "pl",
    dir: "ltr",
    start_url: routes.home,
    scope: routes.home,
    display: "standalone",
    background_color: brandColors.background,
    theme_color: brandColors.primary,
    categories: ["navigation", "travel", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
