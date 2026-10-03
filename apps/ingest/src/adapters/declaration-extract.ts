import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import type { PageSection } from "../cities/types";

export type ExtractedFact = { attribute: AccessibilityAttribute; value: FactValue; quote: string };

export type Extraction = {
  facts: ExtractedFact[];
  /** Attributes the text speaks about in contradicting ways, e.g. `lift: ambiguous`. */
  skipped: string[];
};

/** Named entities that editors of Polish declarations produce ("&oacute;", "&ndash;", "&bdquo;"). */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  shy: "",
  oacute: "ó",
  Oacute: "Ó",
  ndash: "–",
  mdash: "—",
  bdquo: "„",
  rdquo: "”",
  ldquo: "“",
  lsquo: "‘",
  rsquo: "’",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  middot: "·",
  bull: "•",
  deg: "°",
  sup2: "²",
  times: "×",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code] ?? ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * The "Dostępność architektoniczna" part of an accessibility declaration made from the official
 * template: from the element with `id="a11y-architektura"` up to the next part
 * (`a11y-komunikacja`, "Dostępność komunikacyjno-informacyjna"), or the end. Empty when the
 * declaration has no such part.
 */
export function declarationArchitecture(html: string): string[] {
  const id = html.indexOf('id="a11y-architektura"');
  if (id < 0) return [];
  const start = html.lastIndexOf("<", id);
  const next = html.indexOf('id="a11y-komunikacja"', id);
  return htmlLines(html.slice(start, next > id ? html.lastIndexOf("<", next) : undefined));
}

/** Readable text of an HTML fragment: one line per block element, entities decoded, whitespace collapsed. */
export function htmlLines(html: string): string[] {
  const text = html
    .replace(/<(script|style|audio|video)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h\d|div|tr|td|th|ul|ol|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The lines of one place on a page that describes several. Each section runs from the first line
 * containing `from` (searched after the previous section) up to the first later line containing
 * `to`, or the end. Null when a `from` is not on the page, so a rewritten page yields no facts
 * instead of facts about the wrong building.
 */
export function sliceSections(lines: string[], sections?: PageSection[]): string[] | null {
  if (!sections?.length) return lines;
  const picked: string[] = [];
  let cursor = 0;
  for (const { from, to } of sections) {
    const start = lines.findIndex((l, i) => i >= cursor && l.includes(from));
    if (start < 0) return null;
    const end = to ? lines.findIndex((l, i) => i > start && l.includes(to)) : -1;
    cursor = end >= 0 ? end : lines.length;
    picked.push(...lines.slice(start, cursor));
  }
  return picked;
}

const LETTER = "a-ząćęłńóśźżü";
/**
 * A case-insensitive regex in which `\w` is a Polish letter and `\<` / `\>` mark the start / end of
 * a word (plain JS `\w` and `\b` stop at "ę", so "windę" would never end a word).
 */
const pl = (source: string) =>
  new RegExp(
    source
      .replace(/\\w/g, `[${LETTER}]`)
      .replace(/\\</g, `(?<![${LETTER}0-9])`)
      .replace(/\\>/g, `(?![${LETTER}0-9])`),
    "iu",
  );

/** Abbreviations after which a full stop does not end the sentence ("ul. Szczepańska", "tzw. koperta"). */
const ABBREVIATIONS = "ul|al|os|pl|tzw|św|im|nr|np|ok|tj|godz|ww|in|dr|prof|ks|gen|płk|pn|m";
const SENTENCE_END = new RegExp(
  // A colon before a capital letter ends a lead-in ("Informacje o dostępności toalet: W budynku …").
  `(?<!(?:^|[\\s(])(?:${ABBREVIATIONS})\\.)(?<=[.!?;:])\\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„"–-])`,
  "u",
);
const MAX_QUOTE = 320;

export function sentences(lines: string[]): string[] {
  return lines
    .flatMap((l) => l.split(SENTENCE_END))
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

type Rule = {
  attribute: AccessibilityAttribute;
  /** The sentence talks about this attribute at all. */
  about: RegExp;
  /** It says the thing is there. Defaults to "not `absent`". */
  present?: RegExp;
  /** It says the thing is missing. A sentence matching both `present` and `absent` is ambiguous. */
  absent?: RegExp;
  /** A number to read (door width); without it the value is a boolean. */
  number?: (sentence: string) => number | null;
};

/** A negation; "nie ma przeszkód", "brak barier", "bez progów" deny an obstacle, so they don't count. */
const NO = String.raw`(?:nie ma\w*|brak\w*|nie posiada\w*|nie dysponuj\w*|nie zapewnia\w*|nie wyznaczono|bez)\>(?!\s+(?:\w+\s+)?(?:przeszk|barier|prog|stopni|schod|różnic))`;
/**
 * Words between a negation and the thing it denies: a few, or a list ("brak windy oraz platformy …, a także
 * podjazdu") as long as no word in between starts a new statement ("ale", "jest", "znajduje się" …) and a comma
 * only continues the list ("…, a także", "…, oraz"), not a new clause ("brak znaczników …, windy posiadają …").
 */
const GAP = String.raw`(?:\s+(?!(?:ale|lecz|jednak|natomiast|jest|są|znajduj\w*|posiada\w*|można|ma)\>)(?:[^\s,;]+|[^\s;]+,(?=\s+(?:a\s+także|oraz|ani|lub|i)\>))){0,12}?\s+`;
const missing = (thing: string) => pl(String.raw`${NO}${GAP}?${thing}`);

/** Plans, wishes, requests and what the building "does not allow" describe something that is not there. */
const NOT_YET = pl(String.raw`planuj|planowan|w planach|\<budow[ayię]\>|zostanie|zostaną|\<będzie\>|\<będą\>|prośb|wniosk|modernizac|nie pozwala`);
/**
 * Contact lines, section headings ("Informacje o …", "Opis dostępności …"), evacuation and public
 * transport (lifts at a tram stop) say nothing about the building itself.
 */
const NOT_A_FACT = pl(String.raw`@|\<tel\.|telefon|^informacj[ae] o\>|^opis dost|^dostępność (architektoniczna|komunikac)|ewakuac|przystan`);

const DISABLED = String.raw`(niepełnospr|specjalnymi potrzebami|na wózk|inwalid|dostosowan|przystosowan)`;
const ENTRANCE_LEVEL = String.raw`z poziomu (chodnika|terenu|gruntu|ulicy|0\>|zero)|na poziomie (chodnika|terenu|gruntu|ulicy)|bez schodów|bez stopni|bezprogow|wolne od barier|bez barier`;
const STEPS_BEFORE_ENTRANCE = String.raw`(do|przed) (głównego )?wej(ś|s)ci\w*.*(prowadz\w* schod|znajduj\w* się schod|są schody|stopni)|wej(ś|s)ci\w* (\S+ ){0,2}?po (\S+ )?(schod|stopni)`;

/** "do wejścia", "od drzwi wejściowych", "wejście z podjazdem", "na dziedziniec": the way into the building. */
const ENTRANCE = String.raw`((do|przy|przed|od|obok) (głównego |bocznego )?(wej(ś|s)ci|drzwi|budynk)|wej(ś|s)ci\w* (\S+ ){0,3}?(z|po|przez) (podjazd|pochyln|ramp)|drzwi wej|na (dziedziniec|podwórz|teren))`;

const RULES: Rule[] = [
  {
    attribute: "lift",
    about: pl(String.raw`\<wind(a|y|ę|zie|ą|ach|ami|om)\>|\<dźwig|\<podnośnik|\<platform\w*(?=.*(niepełnospr|pionow|przyschodow|schod|wózk|poziom|piętr))`),
    absent: pl(String.raw`${NO}${GAP}?(wind[yę]|dźwig|podnośnik|platform)|nie jest wyposażon\w* w wind`),
  },
  {
    attribute: "ramp",
    // Only a ramp to the entrance or the grounds counts: the matcher reads `ramp` as the way in.
    about: pl(String.raw`(pochylni|\<ramp(a|y|ę|ą|ami)\>|\<podjazd(y|em|u|ami)?\>(?!\s+(wind|wózk))(?!.*samochod))(?=.*${ENTRANCE})|${ENTRANCE}.*(pochylni|\<ramp(a|y|ę|ą|ami)\>|\<podjazd(y|em|u|ami)?\>(?!\s+(wind|wózk))(?!.*samochod))`),
    absent: missing(String.raw`(pochylni|ramp|podjazd)`),
  },
  {
    attribute: "toilet_accessible",
    about: pl(String.raw`(toalet|\<wc\>|łazien)\w*(?=.*${DISABLED})|${DISABLED}.*(toalet|\<wc\>|łazien)|dostępn\w* toalet|toalet\w* dostępn`),
    absent: pl(String.raw`${NO}${GAP}?(toalet|\<wc\>|łazien)|toalet\w*.*\<nie (jest|są) (\S+ )?(przystosowan|dostosowan)`),
  },
  {
    attribute: "changing_table",
    about: pl(String.raw`przewijak`),
    absent: missing("przewijak"),
  },
  {
    attribute: "disabled_parking",
    about: pl(
      String.raw`kopert[aęy]\>|(parking|postoj|parkowan)\w*(?=.*\<dla (os[óo]b|pojazd|samochod|kierow)\w*[^.]{0,40}?(niepełnospr|specjalnymi potrzebami|inwalid))`,
    ),
    absent: missing(String.raw`(\S+ )?(miejsc\w* (parkingow|postojow)|parking|kopert)`),
  },
  {
    attribute: "entrance_level",
    about: pl(String.raw`wej(ś|s)ci\w*(?=.*(${ENTRANCE_LEVEL}))|${STEPS_BEFORE_ENTRANCE}`),
    present: pl(String.raw`wej(ś|s)ci\w*(?=.*(${ENTRANCE_LEVEL}))`),
    absent: pl(STEPS_BEFORE_ENTRANCE),
  },
  {
    attribute: "door_width_cm",
    about: pl(String.raw`(drzw|wej(ś|s)ci)\w*.*szerok\w*.*\d{2,3}\s*cm|szerok\w*.*(drzw|wej(ś|s)ci)\w*.*\d{2,3}\s*cm`),
    number: (s) => {
      if (/wind/i.test(s)) return null;
      const widths = [...s.matchAll(/(\d{2,3})\s*cm/g)].map((m) => Number(m[1])).filter((n) => n >= 60 && n <= 300);
      return new Set(widths).size === 1 ? widths[0] : null;
    },
  },
];

const quoteOf = (sentence: string) =>
  sentence.length > MAX_QUOTE ? `${sentence.slice(0, MAX_QUOTE - 1).trimEnd()}…` : sentence;

function valuesOf(rule: Rule, sentence: string): FactValue[] {
  if (rule.number) {
    const n = rule.number(sentence);
    return n === null ? [] : [{ kind: "number", number: n, unit: "cm" }];
  }
  const absent = rule.absent?.test(sentence) ?? false;
  const present = rule.present ? rule.present.test(sentence) : !absent;
  if (present && absent) return [{ kind: "boolean", boolean: true }, { kind: "boolean", boolean: false }];
  return [{ kind: "boolean", boolean: present }];
}

/**
 * Facts stated in plain words in a page section, read one sentence at a time. A sentence about
 * something planned, a contact line or a heading is ignored. When sentences of one section disagree
 * (a lift in one building, none in another), the attribute is skipped: an unclear text gives no
 * fact rather than a guessed one.
 */
export function extractFacts(lines: string[]): Extraction {
  const found = new Map<AccessibilityAttribute, { value: FactValue; quote: string }[]>();
  for (const sentence of sentences(lines)) {
    if (NOT_A_FACT.test(sentence) || NOT_YET.test(sentence)) continue;
    for (const rule of RULES) {
      if (!rule.about.test(sentence)) continue;
      const list = found.get(rule.attribute) ?? [];
      for (const value of valuesOf(rule, sentence)) list.push({ value, quote: quoteOf(sentence) });
      found.set(rule.attribute, list);
    }
  }

  const facts: ExtractedFact[] = [];
  const skipped: string[] = [];
  for (const rule of RULES) {
    const list = found.get(rule.attribute);
    if (!list?.length) continue;
    if (new Set(list.map((f) => JSON.stringify(f.value))).size > 1) {
      skipped.push(`${rule.attribute}: ambiguous`);
      continue;
    }
    facts.push({ attribute: rule.attribute, value: list[0].value, quote: list[0].quote });
  }
  return { facts, skipped };
}
