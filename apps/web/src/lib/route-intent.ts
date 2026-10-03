const FOLD_FROM = "ąćęłńóśźż";
const FOLD_TO = "acelnoszz";

/** Lower-case, Polish letters folded, edge punctuation and repeated spaces gone. */
function fold(text: string): string {
  return [...text.trim().toLowerCase()]
    .map((c) => FOLD_TO[FOLD_FROM.indexOf(c)] ?? c)
    .join("")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ");
}

// Folded; the longest first so "zaprowadz mnie do" wins over "zaprowadz mnie".
const ROUTE_PHRASES = [
  "zaprowadz mnie do",
  "zaprowadz mnie na",
  "zaprowadz mnie",
  "wyznacz trase do",
  "wyznacz trase na",
  "wyznacz trase",
  "jak dojsc do",
  "jak dojsc na",
  "jak dojade do",
  "jak dojechac do",
  "jak trafic do",
  "jak trafic na",
  "prowadz do",
  "prowadz mnie do",
  "trasa do",
  "trasa na",
];

const BARE_PREPOSITIONS = new Set(["do", "na"]);

/** The place name the query asks a route to ("zaprowadź mnie do Sukiennic" → "sukiennic"), or null when it is no route request. */
export function routeIntent(query: string): string | null {
  const text = fold(query);
  const phrase = ROUTE_PHRASES.find((p) => text.startsWith(`${p} `));
  if (!phrase) return null;
  const destination = text.slice(phrase.length + 1).trim();
  return destination && !BARE_PREPOSITIONS.has(destination) ? destination : null;
}

/**
 * The one place a route request clearly points to: the only hit, or the only hit whose name is the asked-for text.
 * Anything vaguer stays a plain list, because a misheard destination must not get a route button.
 */
export function routeTarget<T extends { name: string }>(query: string, hits: readonly T[]): T | null {
  const wanted = routeIntent(query);
  if (!wanted || hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  const exact = hits.filter((hit) => fold(hit.name) === wanted);
  return exact.length === 1 ? exact[0] : null;
}
