import { categories } from "@krakow-bez-barier/contracts";

const LANDMARKS = new Set(categories.filter((c) => c.landmark).map((c) => c.id));

const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export const MAX_SEARCH_RANK = 4;

/** Whether a text search names something: a single letter does not, so its hits keep the plain order (distance or name). */
export function ranksByName(query: string): boolean {
  return words(query).join("").length >= 2;
}

/**
 * How well a place's name answers a text search, lower is better; the list breaks ties by distance (or name).
 * Both texts must already be folded the same way (lower-case, no diacritics):
 * 0 the whole name is the query · 1 a landmark (a category flagged `landmark`: museum, monument, attraction or another
 * public place, not a hotel or restaurant) whose name words start with the query
 * words, "Zamek Królewski na Wawelu" for "wawel" · 2 every query word is a whole name word, "Hotel Wawel" ·
 * 3 every query word starts a name word, "Pod Wawelem" · 4 anything else the search let through (inside a word, the
 * address).
 */
export function searchRank(name: string, category: string, query: string): number {
  const nameWords = words(name);
  const queryWords = words(query);
  if (!ranksByName(query)) return 0;
  if (nameWords.join(" ") === queryWords.join(" ")) return 0;
  const starts = queryWords.every((q) => nameWords.some((w) => w.startsWith(q)));
  if (starts && LANDMARKS.has(category)) return 1;
  if (queryWords.every((q) => nameWords.includes(q))) return 2;
  return starts ? 3 : 4;
}
