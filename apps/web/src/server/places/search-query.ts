import { normalizeText } from "./repository";

// Folded forms (see `normalizeText`): "zaprowadź" is "zaprowadz".
const LEADING_PHRASES = [
  "zaprowadz mnie do",
  "zaprowadz mnie na",
  "zaprowadz mnie",
  "prowadz do",
  "jak dojsc do",
  "jak dojsc na",
  "jak dojade do",
  "jak dojechac do",
  "gdzie jest",
  "gdzie sa",
  "pokaz mi",
  "pokaz",
  "znajdz mi",
  "znajdz",
  "wyszukaj",
  "szukam",
];
const LEADING_PREPOSITIONS = ["do", "na", "w", "we", "przy", "k", "ku"];

// Longest first. Letters are folded, so "ów" is "ow" and "ą" is "a".
const ENDINGS = ["iego", "ego", "emu", "ach", "ami", "ow", "ej", "ie", "ym", "im", "u", "a", "y", "i", "e", "o"];
const MIN_STEM = 3;
const SHORTEN_FROM = 4;

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function stripLeading(text: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim();
  }
  return text;
}

/**
 * Drops a spoken or typed lead-in ("pokaż mi", "zaprowadź mnie do", a leading preposition) and edge
 * punctuation from a query. Returns the folded text; empty when nothing but filler was left, in which
 * case the caller keeps the plain normalized query.
 */
export function cleanSearchText(query: string): string {
  let text = normalizeText(query).replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ");
  text = stripLeading(text, LEADING_PHRASES);
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = stripLeading(text, LEADING_PREPOSITIONS);
  }
  return text.replace(EDGE_PUNCTUATION, "");
}

/**
 * Crude Polish de-inflection for a fallback pass: each word loses its case ending and, when long enough,
 * one more letter, so the stem is a prefix of the base form ("Wawelu" → "wawe", "dworca" → "dwor" for
 * "dworzec", "rynku" → "ryn" for "rynek"). Only ever used when the exact text found nothing.
 */
export function deinflectSearchText(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const ending = ENDINGS.find((e) => word.endsWith(e) && word.length - e.length >= MIN_STEM);
      const stem = ending ? word.slice(0, -ending.length) : word;
      return ending && stem.length >= SHORTEN_FROM ? stem.slice(0, -1) : stem;
    })
    .join(" ");
}

/**
 * The texts to search for, in the order they are tried: what was typed, then without lead-in, then
 * de-inflected. The first one that finds a place wins, so an exact hit always beats the base form.
 */
export function searchTextAttempts(query: string): string[] {
  const typed = normalizeText(query);
  const cleaned = cleanSearchText(query) || typed;
  return [...new Set([typed, cleaned, deinflectSearchText(cleaned)].filter(Boolean))];
}
