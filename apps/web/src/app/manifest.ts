import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { brandColors } from "@/lib/pwa/brand-colors";
import { routes } from "@/lib/routes";

// Fetched by the browser without cookies, so it is always in the default language.
export default function manifest(): MetadataRoute.Manifest {
  const t = messagesFor(defaultLocale);
  return {
    id: routes.home,
    name: t.common.app.name,
    short_name: t.pwa.shortName,
    description: t.common.app.description,
    lang: defaultLocale,
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
