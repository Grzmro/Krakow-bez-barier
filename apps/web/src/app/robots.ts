import type { MetadataRoute } from "next";

/** The demo is shared by link only; crawlers are asked to stay out. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
