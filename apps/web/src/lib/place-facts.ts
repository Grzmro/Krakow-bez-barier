import type {
  AccessibilityAttribute,
  AccessibilityFact,
  Place,
  ReliabilityStatus,
  ResolvedAttribute,
  Source,
  components,
} from "@krakow-bez-barier/contracts";
import { categories } from "@krakow-bez-barier/contracts";
import type { FactSource, Reliability } from "@krakow-bez-barier/ui";
import { factValueText, joinValue } from "@/i18n/fact-value";
import { intlLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { sourceTextLang } from "@/lib/source-text";

export { joinValue };

type FactValue = components["schemas"]["FactValue"];

/** Attributes shown on the card, in reading order: the overall wheelchair tag, entrance, then facilities. */
export const CARD_ATTRIBUTES = [
  "wheelchair_overall",
  "step_count",
  "step_height_cm",
  "threshold_cm",
  "door_width_cm",
  "automatic_door",
  "ramp",
  "lift",
  "levels",
  "surface",
  "toilet_accessible",
  "bench",
  "disabled_parking",
  "changing_table",
] as const satisfies readonly AccessibilityAttribute[];

/** The card's attributes for a category: its own list when it has one (a stop's platform), else the venue set. */
export function cardAttributes(category: string): readonly AccessibilityAttribute[] {
  return categories.find((c) => c.id === category)?.cardAttributes ?? CARD_ATTRIBUTES;
}

export const RELIABILITY: Record<ReliabilityStatus, Reliability> = {
  confirmed: "confirmed",
  unverified: "unverified",
  outdated: "outdated",
  conflict: "conflict",
  no_data: "unknown",
};

export interface FactView {
  attribute: AccessibilityAttribute;
  label: string;
  /** Value text without the unit; undefined when unknown. */
  value?: string;
  unit?: string;
  reliability: Reliability;
  sources: FactSource[];
  unknown: boolean;
  conflict: boolean;
  /** The fact a visitor confirms with "Potwierdzam, byłem tu"; only for a single known value. */
  confirmFactId?: string;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A date as the UI shows it (`3.10.2026`); `month: "long"` for speech (`3 października 2026`). */
export function formatDate(iso: string, locale: Locale, month: "numeric" | "long" = "numeric"): string {
  const key = `${locale}-${month}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale[locale], {
      day: "numeric",
      month,
      year: "numeric",
      timeZone: "Europe/Warsaw",
    });
    dateFormats.set(key, format);
  }
  return format.format(new Date(iso));
}

/** Formats one typed value; the unit is split off so the UI can style it. */
export function formatValue(
  attribute: AccessibilityAttribute,
  value: FactValue,
  locale: Locale,
): { value: string; unit?: string } {
  return factValueText(attribute, value, messagesFor(locale).place, locale);
}

function factSource(fact: AccessibilityFact, withValue: boolean, locale: Locale): FactSource {
  const m = messagesFor(locale);
  const t = m.place;
  const confirmations = fact.evidence?.confirmations ?? 0;
  const detail = [
    fact.entrance ? t.entrance[fact.entrance] : null,
    t.level[fact.reliability],
    fact.confirmedAt ? t.lastConfirmed(formatDate(fact.confirmedAt, locale)) : null,
    fact.observedAt && !fact.confirmedAt ? t.sourceAsOf(formatDate(fact.observedAt, locale)) : null,
    fact.reliability === "community" && confirmations > 0
      ? confirmations >= 2
        ? t.communityConfirmed
        : t.confirmations(confirmations)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const asOf = fact.confirmedAt ?? fact.observedAt ?? fact.fetchedAt;
  // A visitor's report comment is moderation material, not a statement of the source.
  const note = fact.source.kind === "user_report" ? undefined : (fact.evidence?.comment ?? undefined);
  return {
    name: fact.source.name,
    nameLang: sourceTextLang(fact.source.name, locale),
    note,
    noteLang: note ? sourceTextLang(note, locale) : undefined,
    date: formatDate(fact.fetchedAt, locale),
    value: withValue ? joinValue(formatValue(fact.attribute, fact.value, locale)) : undefined,
    detail,
    staleNote: fact.stale ? m.common.fact.maybeOutdated(formatDate(asOf, locale)) : undefined,
    link: fact.evidence?.url ? { href: fact.evidence.url, label: t.sourcePage } : undefined,
  };
}

/** Rows the card lists only when a source says something: few sources know them, so "Brak danych" there is noise. */
const ONLY_WITH_FACTS: readonly AccessibilityAttribute[] = ["automatic_door"];

/** The attributes the place card lists for this place, in order — shared by the card and the widget API. */
export function cardRows(place: Pick<Place, "category" | "attributes">): AccessibilityAttribute[] {
  const byAttribute = new Map(place.attributes.map((a) => [a.attribute, a]));
  const steps = byAttribute.get("step_count");
  const stepsKnownZero = steps?.state === "known" && steps.value?.kind === "number" && steps.value.number === 0;
  return cardAttributes(place.category).filter((attribute) => {
    if (ONLY_WITH_FACTS.includes(attribute)) return (byAttribute.get(attribute)?.facts.length ?? 0) > 0;
    // With a known step-free entrance, step height and ramp are moot unless a source says something.
    if (!stepsKnownZero) return true;
    if (attribute !== "ramp" && attribute !== "step_height_cm") return true;
    return (byAttribute.get(attribute)?.facts.length ?? 0) > 0;
  });
}

/** One card row per attribute; attributes the API didn't return are named as missing, never hidden. */
export function factViews(place: Place, locale: Locale): FactView[] {
  const m = messagesFor(locale);
  const byAttribute = new Map<AccessibilityAttribute, ResolvedAttribute>(place.attributes.map((a) => [a.attribute, a]));

  return cardRows(place).map((attribute) => {
    const resolved = byAttribute.get(attribute);
    const label = m.common.attribute[attribute];
    if (!resolved || resolved.state === "unknown" || resolved.facts.length === 0) {
      return { attribute, label, reliability: "unknown", sources: [], unknown: true, conflict: false };
    }
    const conflict = resolved.state === "conflict";
    const sources = resolved.facts.map((f) => factSource(f, conflict, locale));
    if (conflict) {
      const values = [...new Set(resolved.facts.map((f) => joinValue(formatValue(attribute, f.value, locale))))];
      return { attribute, label, value: values.join(m.place.value.separator), reliability: "conflict", sources, unknown: false, conflict };
    }
    const shown = resolved.value ?? resolved.facts[0].value;
    const formatted = formatValue(attribute, shown, locale);
    const shownFact = resolved.facts.find((f) => JSON.stringify(f.value) === JSON.stringify(shown)) ?? resolved.facts[0];
    return {
      attribute,
      label,
      value: formatted.value,
      unit: formatted.unit,
      reliability: RELIABILITY[resolved.status],
      sources,
      unknown: false,
      conflict: false,
      confirmFactId: shownFact.id,
    };
  });
}

/**
 * Rows with something to show (a value or a conflict) in their order, and the rows without data apart, so a list can
 * lead with what is known and name the missing ones together — still named, never hidden, never counted as accessible.
 */
export function splitUnknown<T extends { unknown: boolean }>(facts: readonly T[]): { known: T[]; unknown: T[] } {
  return { known: facts.filter((f) => !f.unknown), unknown: facts.filter((f) => f.unknown) };
}

/** Sources whose last refresh failed — their facts are last known data. */
export function failedSources(place: Place): Source[] {
  return place.sources.filter((s) => s.refreshStatus === "outage");
}

/** Most recent successful fetch across the place's sources. */
export function latestSourceDate(place: Place): string | undefined {
  const dates = place.sources.map((s) => s.lastSuccessAt).filter((d): d is string => !!d);
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined;
}

const OSM_RECORD = /^(?:osm:)?(node|way|relation)\/(\d+)(?:[@;].*)?$/;

export interface OsmRecord {
  type: "node" | "way" | "relation";
  id: string;
}

/** The OSM object behind a recordRef: `osm:way/2@v3;geofabrik-2026-10-02` and bare `way/2` both give way 2. */
export function parseOsmRecordRef(recordRef: string): OsmRecord | undefined {
  const match = OSM_RECORD.exec(recordRef);
  return match ? { type: match[1] as OsmRecord["type"], id: match[2] } : undefined;
}

/** "Edytuj w OpenStreetMap" link for the place's OSM object, built from the OSM source's own URL — never its entrance's. */
export function osmEditUrl(place: Place): string | undefined {
  for (const fact of place.attributes.flatMap((a) => a.facts).filter((f) => !f.entrance)) {
    const record =
      fact.source.kind === "community" && fact.source.recordRef ? parseOsmRecordRef(fact.source.recordRef) : undefined;
    const base = record ? place.sources.find((s) => s.id === fact.source.id)?.url : undefined;
    if (!record || !base) continue;
    const url = new URL("/edit", base);
    url.searchParams.set(record.type, record.id);
    return url.toString();
  }
  return undefined;
}
