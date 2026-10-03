import { describe, expect, it } from "vitest";
import { bool, fact, NOW, num, text } from "./fixtures";
import { matchProfile } from "./matcher";
import type { ProfileConfig } from "./profiles";
import { resolveAttributes } from "./resolver";
import type { AccessibilityFact } from "./types";

const confirmed = { reliability: "confirmed", sourceId: "msip" } as const;

const wheelchairOk = (extra: Partial<AccessibilityFact> = {}): AccessibilityFact[] => [
  fact("step_count", num(0, "count"), extra),
  fact("threshold_cm", num(1), extra),
  fact("door_width_cm", num(100), extra),
  fact("toilet_accessible", bool(true), extra),
];

const match = (profile: string | ProfileConfig, facts: AccessibilityFact[]) =>
  matchProfile(profile, resolveAttributes(facts, NOW));

describe("matchProfile", () => {
  it("never says met for a place with no data (US-3.4)", () => {
    // GIVEN a place without any facts
    // WHEN matching the wheelchair profile
    const verdict = match("wheelchair", []);
    // THEN it is unknown and lists what is missing
    expect(verdict.state).toBe("unknown");
    expect(verdict.unknowns).toEqual(
      expect.arrayContaining(["step_count", "threshold_cm", "door_width_cm", "toilet_accessible"]),
    );
  });

  it("is met only when every need is met on known data", () => {
    // GIVEN confirmed facts passing every threshold
    // WHEN matching
    const verdict = match("wheelchair", wheelchairOk(confirmed));
    // THEN the place meets the profile and nothing is flagged unconfirmed
    expect(verdict).toMatchObject({ state: "met", unconfirmed: false, blockers: [], unknowns: [] });
  });

  it("flags a met verdict that rests on unverified data", () => {
    // GIVEN the same facts from a community source
    // WHEN matching
    const verdict = match("wheelchair", wheelchairOk());
    // THEN it is met but unconfirmed
    expect(verdict).toMatchObject({ state: "met", unconfirmed: true });
  });

  it("never says met when a needed attribute is in conflict (US-3.3)", () => {
    // GIVEN a toilet fact the two sources disagree on, everything else passing
    const facts = [
      ...wheelchairOk(confirmed).filter((f) => f.attribute !== "toilet_accessible"),
      fact("toilet_accessible", bool(true), { sourceId: "osm" }),
      fact("toilet_accessible", bool(false), { sourceId: "msip", reliability: "confirmed" }),
    ];
    // WHEN matching
    const verdict = match("wheelchair", facts);
    // THEN the verdict is conflict
    expect(verdict.state).toBe("conflict");
    expect(verdict.unknowns).toContain("toilet_accessible");
  });

  it("reports a barrier when a threshold fails, even if other needs are unknown", () => {
    // GIVEN a 5 cm threshold and nothing else
    // WHEN matching the wheelchair profile
    const verdict = match("wheelchair", [fact("threshold_cm", num(5))]);
    // THEN the place does not meet it and the threshold is the blocker
    expect(verdict.state).toBe("barrier");
    expect(verdict.blockers).toEqual(["threshold_cm"]);
  });

  it("accepts a ramp or a lift as an alternative to a step-free entrance", () => {
    // GIVEN a step count of 3 but a ramp, plus the other needs met
    const facts = [...wheelchairOk(confirmed).filter((f) => f.attribute !== "step_count"),
      fact("step_count", num(3, "count"), confirmed), fact("ramp", bool(true), confirmed)];
    // WHEN matching
    // THEN the entrance need is met
    expect(match("wheelchair", facts).state).toBe("met");
  });

  it("treats steps without any ramp or lift data as unknown, not a barrier", () => {
    // GIVEN steps and no information about ramps or lifts
    // WHEN matching
    const verdict = match("wheelchair", [fact("step_count", num(3, "count"))]);
    // THEN the entrance is not met and not yet a barrier
    expect(verdict.state).toBe("unknown");
  });

  it("treats wheelchair=yes as step-free and wheelchair=no as a blocker", () => {
    // GIVEN only OSM's overall wheelchair tag
    // WHEN matching with yes and with no
    const yes = match("wheelchair", [fact("wheelchair_overall", text("yes"))]);
    const no = match("wheelchair", [fact("wheelchair_overall", text("no"))]);
    // THEN yes is not enough for a met verdict, and no blocks
    expect(yes.state).toBe("unknown");
    expect(yes.unknowns).not.toContain("wheelchair_overall");
    expect(no).toMatchObject({ state: "barrier", blockers: ["wheelchair_overall"] });
  });

  it("does not meet a need with wheelchair=limited", () => {
    // GIVEN wheelchair=limited and every other need met
    const facts = [
      ...wheelchairOk(confirmed).filter((f) => f.attribute !== "step_count"),
      fact("wheelchair_overall", text("limited"), confirmed),
    ];
    // WHEN matching
    // THEN the entrance stays unknown
    expect(match("wheelchair", facts).state).toBe("unknown");
  });

  it("never says met on stale data", () => {
    // GIVEN all facts last observed 13 months ago
    const facts = wheelchairOk({ ...confirmed, observedAt: "2025-08-01T00:00:00Z" });
    // WHEN matching
    // THEN the verdict is unknown
    expect(match("wheelchair", facts).state).toBe("unknown");
  });

  it("uses different thresholds and an extra need for the stroller profile", () => {
    // GIVEN a 4 cm threshold, a 75 cm door, a step-free entrance and a toilet
    const base = [
      fact("step_count", num(0, "count"), confirmed),
      fact("threshold_cm", num(4), confirmed),
      fact("door_width_cm", num(75), confirmed),
      fact("toilet_accessible", bool(true), confirmed),
    ];
    // WHEN matching both profiles
    // THEN the wheelchair profile is blocked, the stroller profile still needs a changing table
    expect(match("wheelchair", base).state).toBe("barrier");
    expect(match("stroller", base)).toMatchObject({ state: "unknown", unknowns: ["changing_table"] });
    expect(match("stroller", [...base, fact("changing_table", bool(true), confirmed)]).state).toBe("met");
  });

  it("supports a new profile as configuration only (US-2.8)", () => {
    // GIVEN a profile defined as plain config that needs a bench
    const senior: ProfileConfig = {
      id: "senior",
      needs: [
        {
          id: "bench",
          label: "Ławka",
          mode: "all",
          conditions: [{ attribute: "bench", rule: { type: "isTrue" } }],
        },
      ],
    };
    // WHEN matching with and without bench data
    // THEN no code change is needed
    expect(match(senior, []).state).toBe("unknown");
    expect(match(senior, [fact("bench", bool(true), confirmed)]).state).toBe("met");
  });

  it("throws on an unknown profile id", () => {
    // GIVEN an id with no configuration
    // WHEN matching
    // THEN it fails loudly instead of returning a verdict
    expect(() => matchProfile("nope", [])).toThrow("Unknown profile");
  });

  it("never says met when a blocking condition conflicts, even if an alternative is met", () => {
    // GIVEN no steps, but wheelchair_overall is yes in one source and no in another
    const facts = [
      ...wheelchairOk(confirmed),
      fact("wheelchair_overall", text("yes"), { sourceId: "osm" }),
      fact("wheelchair_overall", text("no"), { sourceId: "msip", reliability: "confirmed" }),
    ];
    // WHEN matching
    // THEN the verdict is conflict
    expect(match("wheelchair", facts).state).toBe("conflict");
  });

  it("never gives a green verdict from an empty configuration", () => {
    // GIVEN a profile with no needs and one need with no conditions
    const empty: ProfileConfig = { id: "empty", needs: [] };
    const noConditions: ProfileConfig = { id: "x", needs: [{ id: "n", label: "n", mode: "all", conditions: [] }] };
    // WHEN matching
    // THEN both are unknown
    expect(match(empty, []).state).toBe("unknown");
    expect(match(noConditions, []).state).toBe("unknown");
  });

  it("keeps sample data unconfirmed in a met verdict", () => {
    // GIVEN every needed fact is sample data, even with many confirmations
    const facts = wheelchairOk({ reliability: "sample", evidence: { confirmations: 5 } });
    // WHEN matching
    // THEN it is met but unconfirmed
    expect(match("wheelchair", facts)).toMatchObject({ state: "met", unconfirmed: true });
  });
});
