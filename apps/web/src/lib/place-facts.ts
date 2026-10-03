import type {
  AccessibilityAttribute,
  AccessibilityFact,
  Place,
  ReliabilityStatus,
  ResolvedAttribute,
  Source,
  components,
} from "@krakow-bez-barier/contracts";
import type { FactSource, Reliability } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";

type FactValue = components["schemas"]["FactValue"];

const t = pl.place;

/** Attributes shown on the card, in reading order: entrance first, then facilities. */
export const CARD_ATTRIBUTES = [
  "step_count",
  "step_height_cm",
  "threshold_cm",
  "door_width_cm",
  "ramp",
  "lift",
  "surface",
  "toilet_accessible",
  "bench",
  "disabled_parking",
  "changing_table",
] as const satisfies readonly AccessibilityAttribute[];

const RELIABILITY: Record<ReliabilityStatus, Reliability> = {
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
}

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Formats one typed value; the unit is split off so the UI can style it. */
export function formatValue(attribute: AccessibilityAttribute, value: FactValue): { value: string; unit?: string } {
  switch (value.kind) {
    case "boolean":
      return { value: value.boolean ? t.value.yes : t.value.no };
    case "number":
      if (attribute === "step_count") {
        return { value: value.number === 0 ? t.value.noSteps : t.value.steps(value.number) };
      }
      return { value: String(value.number).replace(".", ","), unit: value.unit ? t.unit[value.unit] || undefined : undefined };
    case "text":
      return { value: t.surface[value.text] ?? value.text };
  }
}

function joinValue(v: { value: string; unit?: string }) {
  return v.unit ? `${v.value} ${v.unit}` : v.value;
}

function factSource(fact: AccessibilityFact, withValue: boolean): FactSource {
  const confirmations = fact.evidence?.confirmations ?? 0;
  const detail = [
    t.level[fact.reliability],
    fact.confirmedAt ? t.lastConfirmed(formatDate(fact.confirmedAt)) : null,
    fact.reliability === "community" && confirmations > 0
      ? confirmations >= 2
        ? t.communityConfirmed
        : t.confirmations(confirmations)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const asOf = fact.confirmedAt ?? fact.observedAt ?? fact.fetchedAt;
  return {
    name: fact.source.name,
    date: formatDate(fact.fetchedAt),
    value: withValue ? joinValue(formatValue(fact.attribute, fact.value)) : undefined,
    detail,
    staleNote: fact.stale ? pl.common.fact.maybeOutdated(formatDate(asOf)) : undefined,
  };
}

/** One card row per attribute; attributes the API didn't return are named as missing, never hidden. */
export function factViews(place: Place): FactView[] {
  const byAttribute = new Map<AccessibilityAttribute, ResolvedAttribute>(place.attributes.map((a) => [a.attribute, a]));
  const stepsKnownZero = (() => {
    const steps = byAttribute.get("step_count");
    return steps?.state === "known" && steps.value?.kind === "number" && steps.value.number === 0;
  })();

  return CARD_ATTRIBUTES.filter((attribute) => {
    // With a known step-free entrance, step height and ramp are moot unless a source says something.
    if (!stepsKnownZero) return true;
    if (attribute !== "ramp" && attribute !== "step_height_cm") return true;
    return (byAttribute.get(attribute)?.facts.length ?? 0) > 0;
  }).map((attribute) => {
    const resolved = byAttribute.get(attribute);
    const label = pl.common.attribute[attribute];
    if (!resolved || resolved.state === "unknown" || resolved.facts.length === 0) {
      return { attribute, label, reliability: "unknown", sources: [], unknown: true, conflict: false };
    }
    const conflict = resolved.state === "conflict";
    const sources = resolved.facts.map((f) => factSource(f, conflict));
    if (conflict) {
      const values = [...new Set(resolved.facts.map((f) => joinValue(formatValue(attribute, f.value))))];
      return { attribute, label, value: values.join(t.value.separator), reliability: "conflict", sources, unknown: false, conflict };
    }
    const shown = resolved.value ?? resolved.facts[0].value;
    const formatted = formatValue(attribute, shown);
    return {
      attribute,
      label,
      value: formatted.value,
      unit: formatted.unit,
      reliability: RELIABILITY[resolved.status],
      sources,
      unknown: false,
      conflict: false,
    };
  });
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
