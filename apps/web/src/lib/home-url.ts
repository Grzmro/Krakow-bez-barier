import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { FEATURE_FILTERS, isSearching, NO_CHOICES, type HomeCommitted } from "@/lib/home-start";

/** Whether the query is around the device (`near=1`); a point the user chose by name is not kept. */
const aroundDevice = ({ nearby }: HomeCommitted) => Boolean(nearby && !nearby.place);

/**
 * The committed query as a query string (`?q=…&category=…&features=a,b&unknown=1&near=1`), so Back to the home
 * screen shows the same results. The position itself is never put in the URL; it is personal and lives only on the
 * device. `near=1` only says the results were around the device, so the screen asks the device again.
 */
export function committedToSearch(committed: HomeCommitted, near = aroundDevice(committed)): string {
  const { q, category, features, showUnknown } = committed;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (features.length) params.set("features", features.join(","));
  if (features.length && showUnknown) params.set("unknown", "1");
  if (near) params.set("near", "1");
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

/** Whether the URL asks for results around the device. */
export function searchWantsNear(search: string): boolean {
  return new URLSearchParams(search).get("near") === "1";
}
