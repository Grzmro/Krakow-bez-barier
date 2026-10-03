import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { QUICK_ACTIONS, type QuickAction } from "./quick-actions";

/**
 * What a "nearest X" phrase asks for: the home quick action for it (nearest toilet, lift, bench, pharmacy,
 * stop), otherwise just a category, sorted from the user's position.
 */
export type NearestCommand = { quick?: QuickAction; category?: string };

/** `null`: an ordinary search. `unknown`: it asks for the nearest something we couldn't tell what. */
export type NearestParse = { kind: "nearest"; command: NearestCommand } | { kind: "unknown" } | null;

export interface CommandCategory {
  id: string;
  label: string;
  singularLabel: string;
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

const tokens = (text: string) => normalise(text).split(/[^a-z0-9]+/).filter(Boolean);

// Normalised word beginnings that say "close to me" (Polish endings vary: najbliższa/najbliższy/najbliższą…).
const NEAREST_STEMS = ["najblizsz", "najblizej", "poblizu", "blisko", "nearest", "closest", "nearby"];
const NEAREST_PAIRS = [
  ["kolo", "mnie"],
  ["obok", "mnie"],
  ["near", "me"],
  ["close", "me"],
  ["around", "me"],
];

// Word beginnings per target, beyond the category labels themselves (synonyms, features, English).
const CATEGORY_STEMS: Record<string, string[]> = {
  toilet: ["toalet", "szalet", "wc", "toilet", "restroom", "bathroom"],
  pharmacy: ["aptek", "pharmac", "chemist", "drugstore"],
  parking: ["parking", "postoj"],
  transit_stop: ["przystan", "bus"],
  restaurant: ["restaura", "kawiar", "knajp", "cafe", "coffee"],
  museum: ["muze", "museum"],
  hotel: ["hotel", "nocleg", "hostel"],
  theatre: ["teatr", "kino", "cinema"],
};
const FEATURE_STEMS: Record<string, FeatureFilter> = {
  wind: "lift",
  lift: "lift",
  elevator: "lift",
  lawk: "bench",
  bench: "bench",
};
// Features and categories whose stems are too short to match as a prefix.
const EXACT = new Set(["wc", "bus", "kino", "lift"]);

const matches = (token: string, stem: string) => (EXACT.has(stem) ? token === stem : token.startsWith(stem));

/** Word beginnings of a category's own name ("Toaleta" → "toalet"), so a category added in config works unaided. */
function labelStems({ label, singularLabel }: CommandCategory) {
  return [...tokens(label), ...tokens(singularLabel)]
    .filter((word) => word.length >= 4 && word !== "lub" && !word.startsWith("miejsc") && !word.startsWith("place"))
    .map((word) => word.replace(/[aeiouy]+$/, "").replace(/s$/, ""))
    .filter((stem) => stem.length >= 4);
}

// A quick action covers a category, or a feature on its own; without one the bare category is all there is.
function withQuick(target: { category?: string; feature?: FeatureFilter }): NearestCommand {
  const actions = QUICK_ACTIONS as readonly QuickAction[];
  const quick = target.category
    ? actions.find((action) => action.category === target.category)
    : actions.find((action) => !action.category && action.features.length === 1 && action.features[0] === target.feature);
  return quick ? { quick, category: quick.category } : { category: target.category };
}

function hasNearestPhrase(words: string[]) {
  return (
    words.some((word) => NEAREST_STEMS.some((stem) => word.startsWith(stem))) ||
    NEAREST_PAIRS.some(([first, second]) => words.some((word, i) => word === first && words[i + 1] === second))
  );
}

/**
 * Reads "najbliższa toaleta", "apteka w pobliżu", "winda koło mnie" (and English twins) as a command to
 * pick the category or feature and sort from the user's position; anything else is an ordinary search.
 * Category names come from the category list (`useCategories`), with synonyms for the common ones.
 */
export function parseNearestCommand(text: string, categories: readonly CommandCategory[]): NearestParse {
  const words = tokens(text);
  if (!hasNearestPhrase(words)) return null;

  for (const category of categories) {
    const stems = [...(CATEGORY_STEMS[category.id] ?? []), ...labelStems(category)];
    if (words.some((word) => stems.some((stem) => matches(word, stem)))) return { kind: "nearest", command: withQuick({ category: category.id }) };
  }
  for (const [stem, feature] of Object.entries(FEATURE_STEMS)) {
    if (words.some((word) => matches(word, stem))) return { kind: "nearest", command: withQuick({ feature }) };
  }
  return { kind: "unknown" };
}
