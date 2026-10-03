import { profiles, type Condition, type Need, type ProfileConfig, type Rule } from "./profiles";
import type {
  AccessibilityAttribute,
  FactValue,
  NeedVerdict,
  ReliabilityStatus,
  ResolvedAttribute,
  Verdict,
} from "./types";

type Evaluation = { verdict: NeedVerdict; status?: ReliabilityStatus; blocking?: boolean };

function passes(rule: Rule, value: FactValue): boolean | "other" | null {
  switch (rule.type) {
    case "max":
    case "min": {
      if (value.kind !== "number") return null;
      return rule.type === "max" ? value.number <= rule.value : value.number >= rule.value;
    }
    case "isTrue":
      return value.kind === "boolean" ? value.boolean : null;
    case "enum": {
      if (value.kind !== "text") return null;
      if (rule.met.includes(value.text)) return true;
      if (rule.barrier.includes(value.text)) return false;
      return "other";
    }
  }
}

function evaluateCondition(
  condition: Condition,
  resolved: Map<AccessibilityAttribute, ResolvedAttribute>,
): Evaluation {
  const attr = resolved.get(condition.attribute);
  if (attr?.state === "conflict") return { verdict: "conflict" };
  if (!attr || attr.state !== "known" || !attr.value) return { verdict: "unknown" };
  const result = passes(condition.rule, attr.value);
  if (result === true) return { verdict: "met", status: attr.status };
  if (result === false) return { verdict: "barrier", blocking: condition.blocking };
  return { verdict: "unknown" };
}

type NeedEvaluation = Evaluation & { conditions: { attribute: AccessibilityAttribute; verdict: NeedVerdict }[] };

function evaluateNeed(
  need: Need,
  resolved: Map<AccessibilityAttribute, ResolvedAttribute>,
): NeedEvaluation {
  const results = need.conditions.map((c) => evaluateCondition(c, resolved));
  const conditions = need.conditions.map((c, i) => ({ attribute: c.attribute, verdict: results[i].verdict }));
  return { ...decideNeed(need, results), conditions };
}

function decideNeed(need: Need, results: Evaluation[]): Evaluation {
  const has = (v: NeedVerdict) => results.some((r) => r.verdict === v);

  if (results.some((r) => r.verdict === "barrier" && r.blocking)) return { verdict: "barrier" };

  if (results.length === 0) return { verdict: "unknown" };

  if (need.mode === "any") {
    if (need.conditions.some((c, i) => c.blocking && results[i].verdict === "conflict")) {
      return { verdict: "conflict" };
    }
    const met = results.filter((r) => r.verdict === "met");
    if (met.length > 0) {
      const confirmed = met.some((r) => r.status === "confirmed");
      return { verdict: "met", status: confirmed ? "confirmed" : "unverified" };
    }
    if (has("conflict")) return { verdict: "conflict" };
    if (results.every((r) => r.verdict === "barrier")) return { verdict: "barrier" };
    return { verdict: "unknown" };
  }

  if (has("barrier")) return { verdict: "barrier" };
  if (has("conflict")) return { verdict: "conflict" };
  if (has("unknown")) return { verdict: "unknown" };
  const allConfirmed = results.every((r) => r.status === "confirmed");
  return { verdict: "met", status: allConfirmed ? "confirmed" : "unverified" };
}

const REASON: Record<NeedVerdict, string> = {
  met: "pasuje",
  barrier: "nie spełnia",
  unknown: "brak danych",
  conflict: "sprzeczne dane",
};

/**
 * Compares resolved attributes with a profile. `met` needs every need met on known, fresh,
 * non-conflicting data; a barrier outranks conflict, conflict outranks unknown.
 */
export function matchProfile(
  profile: ProfileConfig | string,
  attributes: ResolvedAttribute[],
): Verdict {
  const config = typeof profile === "string" ? profiles[profile] : profile;
  if (!config) throw new Error(`Unknown profile: ${String(profile)}`);

  const resolved = new Map(attributes.map((a) => [a.attribute, a]));
  const evaluated = config.needs.map((need) => ({ need, ...evaluateNeed(need, resolved) }));
  const of = (v: NeedVerdict) => evaluated.filter((e) => e.verdict === v);

  const state: NeedVerdict = evaluated.length === 0
    ? "unknown"
    : of("barrier").length
    ? "barrier"
    : of("conflict").length
      ? "conflict"
      : of("unknown").length
        ? "unknown"
        : "met";

  const attributesOf = (items: typeof evaluated, verdicts: NeedVerdict[]) => [
    ...new Set(
      items.flatMap((e) => e.conditions.filter((c) => verdicts.includes(c.verdict)).map((c) => c.attribute)),
    ),
  ];

  return {
    state,
    unconfirmed: state === "met" && evaluated.some((e) => e.status !== "confirmed"),
    reasons: evaluated.map((e) => `${e.need.label}: ${REASON[e.verdict]}`),
    blockers: attributesOf(of("barrier"), ["barrier"]),
    unknowns: attributesOf([...of("unknown"), ...of("conflict")], ["unknown", "conflict"]),
  };
}
