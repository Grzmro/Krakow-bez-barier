import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { FEATURE_FILTERS, isSearching, NO_CHOICES, type HomeCommitted } from "@/lib/home-start";

/**
 * The committed query as a query string (`?q=…&category=…&features=a,b&unknown=1`), so Back to the home screen
 * shows the same results. A position is never put in the URL; it is personal and lives only on the device.
 */
export function committedToSearch({ q, category, features, showUnknown }: HomeCommitted): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (features.length) params.set("features", features.join(","));
  if (features.length && showUnknown) params.set("unknown", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The query a URL asks for; unknown feature names are dropped. Without a search part it is the start state. */
export function searchToCommitted(search: string): HomeCommitted {
  const params = new URLSearchParams(search);
  const features = (params.get("features") ?? "").split(",").filter((f): f is FeatureFilter => (FEATURE_FILTERS as readonly string[]).includes(f));
  const committed: HomeCommitted = {
    ...NO_CHOICES,
    q: (params.get("q") ?? "").trim(),
    category: params.get("category") || null,
    features,
    showUnknown: features.length > 0 && params.get("unknown") === "1",
  };
  return isSearching(committed) ? committed : { ...NO_CHOICES, q: "" };
}
