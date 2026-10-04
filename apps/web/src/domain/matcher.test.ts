import { describe, expect, it } from "vitest";
import type { AccessibilityAttribute, Place, ResolvedAttribute } from "@krakow-bez-barier/contracts";
import { bool as boolFact, fact, NOW, num as numFact, text } from "./fixtures";
import { matchProfile } from "./matcher";
import { PROFILE_PRESETS, thresholdsFor, type Thresholds } from "./profiles";
import { resolveAttributes } from "./resolver";
import type { AccessibilityFact } from "./types";

const wheelchair = PROFILE_PRESETS.wheelchair;
const stroller = PROFILE_PRESETS.stroller;

function known(attribute: AccessibilityAttribute, value: ResolvedAttribute["value"], status: "confirmed" | "unverified" = "confirmed"): ResolvedAttribute {
  return { attribute, state: "known", status, value, facts: [] };
}
const num = (number: number) => ({ kind: "number" as const, number });
const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });

const fullyAccessible: Pick<Place, "attributes"> = {
  attributes: [
    known("step_count", num(0)),
    known("threshold_cm", num(1)),
    known("door_width_cm", num(90)),
    known("lift", bool(true)),
    known("toilet_accessible", bool(true)),
  ],
};

describe("matchProfile with resolved attributes", () => {
  it("returns met only when every need is known and met", () => {
    // GIVEN a place whose every wheelchair need is confirmed
    // WHEN it is checked against the wheelchair presets
    const verdict = matchProfile(fullyAccessible, wheelchair, "pl");
    // THEN it is met and not marked unconfirmed
    expect(verdict.state).toBe("met");
    expect(verdict.unconfirmed).toBe(false);
    expect(verdict.needs?.every((n) => n.state === "met")).toBe(true);
  });

  it("never returns met for a place without data", () => {
    // GIVEN a place with no attributes at all
    // WHEN it is checked against either preset
    // THEN the verdict is unknown, never met
    expect(matchProfile({ attributes: [] }, wheelchair, "pl").state).toBe("unknown");
    expect(matchProfile({ attributes: [] }, stroller, "pl").state).toBe("unknown");
  });

  it("never returns met when a needed attribute is in conflict", () => {
    // GIVEN an otherwise accessible place whose toilet data conflicts
    const place = {
      attributes: fullyAccessible.attributes.map((a) =>
        a.attribute === "toilet_accessible" ? { ...a, state: "conflict" as const, status: "conflict" as const, value: null } : a,
      ),
    };
    // WHEN it is checked
    const verdict = matchProfile(place, wheelchair, "pl");
    // THEN the verdict is conflict and the toilet need says so
    expect(verdict.state).toBe("conflict");
    expect(verdict.needs?.find((n) => n.need === "toilet")?.state).toBe("conflict");
  });

  it("treats stale data as unknown, not as met", () => {
    // GIVEN the only door width is outdated
    const place = {
      attributes: fullyAccessible.attributes.map((a) =>
        a.attribute === "door_width_cm" ? { ...a, state: "stale" as const, status: "outdated" as const } : a,
      ),
    };
    // WHEN it is checked
    // THEN the verdict is unknown
    expect(matchProfile(place, wheelchair, "pl").state).toBe("unknown");
  });

  it("applies the user's thresholds", () => {
    // GIVEN a 3 cm threshold and an 80 cm door
    const place = {
      attributes: [known("step_count", num(0)), known("threshold_cm", num(3)), known("door_width_cm", num(80))],
    };
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const relaxed = { ...entranceOnly, maxThresholdCm: 3, minDoorWidthCm: 80 };
    // WHEN checked against the preset limits and against relaxed thresholds
    const strict = matchProfile(place, entranceOnly, "pl");
    // THEN the presets block it with reasons, the relaxed thresholds accept it
    expect(strict.state).toBe("barrier");
    expect(strict.reasons).toEqual(["próg 3 cm", "drzwi 80 cm"]);
    expect(matchProfile(place, relaxed, "pl").state).toBe("met");
  });

  it("accepts one step for the stroller preset but not for the wheelchair preset", () => {
    // GIVEN one step with a low threshold, and no ramp
    const place = {
      attributes: [known("step_count", num(1)), known("threshold_cm", num(2)), known("ramp", bool(false)), known("door_width_cm", num(90))],
    };
    const noFacilities = { requireLift: false, requireAccessibleToilet: false, requireChangingTable: false };
    // WHEN checked against both presets without facility needs
    // THEN the stroller preset accepts it and the wheelchair preset blocks it
    expect(matchProfile(place, { ...stroller, ...noFacilities }, "pl").state).toBe("met");
    expect(matchProfile(place, { ...wheelchair, ...noFacilities }, "pl").state).toBe("barrier");
  });

  it("never rates one step better than a step-free entrance when the threshold is unknown", () => {
    // GIVEN a step-free and a one-step entrance, both without threshold data
    const noFacilities = { ...stroller, requireLift: false, requireChangingTable: false };
    const stepFree = { attributes: [known("step_count", num(0)), known("door_width_cm", num(90))] };
    const oneStep = { attributes: [known("step_count", num(1)), known("door_width_cm", num(90))] };
    // WHEN checked against the stroller preset
    // THEN both are unknown on the threshold, neither is met
    for (const place of [stepFree, oneStep]) {
      const verdict = matchProfile(place, noFacilities, "pl");
      expect(verdict.state).toBe("unknown");
      expect(verdict.unknowns).toEqual(["threshold_cm"]);
    }
  });

  it("treats steps with unknown ramp data as unknown, and a confirmed missing ramp as a barrier", () => {
    // GIVEN two steps, once without ramp data and once with no ramp
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const noRampData = { attributes: [known("step_count", num(2)), known("door_width_cm", num(90))] };
    const noRamp = { attributes: [...noRampData.attributes, known("ramp", bool(false))] };
    // WHEN checked against the wheelchair preset
    const unknownRamp = matchProfile(noRampData, entranceOnly, "pl");
    // THEN missing ramp data is unknown, a known lack of ramp blocks
    expect(unknownRamp.state).toBe("unknown");
    expect(unknownRamp.unknowns).toEqual(["ramp"]);
    expect(matchProfile(noRamp, entranceOnly, "pl")).toMatchObject({ state: "barrier", reasons: ["2 stopnie"] });
  });

  it("gives the reasons in the requested language", () => {
    // GIVEN two steps and no ramp
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const place = { attributes: [known("step_count", num(2)), known("door_width_cm", num(90)), known("ramp", bool(false))] };
    // WHEN checked in English
    const verdict = matchProfile(place, entranceOnly, "en");
    // THEN the verdict is the same and its reason is English
    expect(verdict).toMatchObject({ state: "barrier", reasons: ["2 steps"] });
  });

  it("accepts a known ramp or level entrance when the number of steps is unknown, like the step_free filter", () => {
    // GIVEN no step count, once with a ramp, once with a level entrance, once with no ramp
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const door = known("door_width_cm", num(90));
    const withRamp = { attributes: [door, known("ramp", bool(true), "unverified")] };
    const level = { attributes: [door, known("entrance_level", bool(true))] };
    const noRamp = { attributes: [door, known("ramp", bool(false))] };
    // WHEN checked against the wheelchair preset
    // THEN a ramp or a level entrance meets the entrance need, no ramp alone can't say
    expect(matchProfile(withRamp, entranceOnly, "pl")).toMatchObject({ state: "met", unconfirmed: true });
    expect(matchProfile(withRamp, entranceOnly, "pl").needs?.[0]).toMatchObject({ need: "entrance", attribute: "ramp", state: "met" });
    expect(matchProfile(level, entranceOnly, "pl").state).toBe("met");
    expect(matchProfile(noRamp, entranceOnly, "pl")).toMatchObject({ state: "unknown", unknowns: ["step_count"] });
  });

  it("meets the entrance only on a sourced level entrance, never on missing step data (Hangar Czyżyny)", () => {
    // GIVEN Hangar's real data: BIP's unverified "Wejście/wyjście jest na poziomie gruntu.", no step count, no door width
    const unknown = (attribute: AccessibilityAttribute): ResolvedAttribute => ({ attribute, state: "unknown", status: "no_data", value: null, facts: [] });
    const hangar = { attributes: [unknown("step_count"), unknown("ramp"), unknown("door_width_cm"), known("entrance_level", bool(true), "unverified")] };
    const notLevel = { attributes: [unknown("step_count"), unknown("ramp"), known("entrance_level", bool(false), "unverified")] };
    const nothing = { attributes: [unknown("step_count"), unknown("ramp"), unknown("entrance_level")] };
    // WHEN checked against the wheelchair preset
    const entranceOf = (place: Pick<Place, "attributes">) => matchProfile(place, wheelchair, "pl").needs?.find((n) => n.need === "entrance");
    // THEN the level entrance meets it, marked unconfirmed and pointing at that fact; without it the entrance stays unknown
    expect(entranceOf(hangar)).toEqual({ need: "entrance", attribute: "entrance_level", state: "met", reason: null, unconfirmed: true });
    expect(matchProfile(hangar, wheelchair, "pl").state).toBe("unknown");
    expect(entranceOf(notLevel)).toMatchObject({ attribute: "step_count", state: "unknown" });
    expect(entranceOf(nothing)).toMatchObject({ attribute: "step_count", state: "unknown" });
  });

  describe("lift and storeys", () => {
    const withoutLift = (...extra: ResolvedAttribute[]) => ({
      attributes: [...fullyAccessible.attributes.map((a) => (a.attribute === "lift" ? known("lift", bool(false)) : a)), ...extra],
    });
    const liftNeed = (place: Pick<Place, "attributes">) => matchProfile(place, wheelchair, "pl").needs?.find((n) => n.need === "lift");

    it("blocks on a missing lift where the place has floors", () => {
      // GIVEN an otherwise accessible place on two storeys without a lift
      const place = withoutLift(known("levels", num(2), "unverified"));
      // WHEN checked against the wheelchair preset
      const verdict = matchProfile(place, wheelchair, "pl");
      // THEN the missing lift is the barrier
      expect(verdict).toMatchObject({ state: "barrier", blockers: ["lift"], unknowns: [], reasons: ["winda: brak"] });
    });

    it("meets the lift need on a single storey, lift or not", () => {
      // GIVEN single-storey places without a lift and without lift data
      const noLift = withoutLift(known("levels", num(1), "unverified"));
      const noLiftData = { attributes: [...fullyAccessible.attributes.filter((a) => a.attribute !== "lift"), known("levels", num(1))] };
      // WHEN checked against the wheelchair preset
      // THEN the lift need is met by the storey count, unconfirmed when that rests on community data
      expect(matchProfile(noLift, wheelchair, "pl")).toMatchObject({ state: "met", unconfirmed: true, blockers: [] });
      expect(liftNeed(noLift)).toMatchObject({ attribute: "levels", state: "met", unconfirmed: true });
      expect(matchProfile(noLiftData, wheelchair, "pl")).toMatchObject({ state: "met", unconfirmed: false });
    });

    it("meets the lift need through the lift where the place has floors", () => {
      // GIVEN an otherwise accessible place on three storeys with a lift
      const place = { attributes: [...fullyAccessible.attributes, known("levels", num(3))] };
      // WHEN checked against the wheelchair preset
      // THEN the lift itself meets the need
      expect(matchProfile(place, wheelchair, "pl")).toMatchObject({ state: "met", blockers: [] });
      expect(liftNeed(place)).toMatchObject({ attribute: "lift", state: "met" });
    });

    it("meets the lift need on one storey even when sources disagree on the lift, but still flags the conflict", () => {
      // GIVEN a single-storey place whose lift data is in conflict
      const place = {
        attributes: [
          ...fullyAccessible.attributes.filter((a) => a.attribute !== "lift"),
          { attribute: "lift", state: "conflict", status: "conflict", value: null, facts: [] } as ResolvedAttribute,
          known("levels", num(1)),
        ],
      };
      // WHEN checked against the wheelchair preset
      // THEN the lift need is met by the storey count, and the overall verdict is a conflict elsewhere
      expect(liftNeed(place)).toMatchObject({ attribute: "levels", state: "met" });
      expect(matchProfile(place, wheelchair, "pl").state).toBe("conflict");
    });

    it("can't say on a missing lift while the number of storeys is unknown", () => {
      // GIVEN an otherwise accessible place known to have no lift, with no storey data
      const place = withoutLift();
      // WHEN checked against the wheelchair preset
      const verdict = matchProfile(place, wheelchair, "pl");
      // THEN the lift is "can't say" with its reason, not a barrier and not met
      expect(verdict).toMatchObject({ state: "unknown", blockers: [], unknowns: ["lift"] });
      expect(verdict.reasons).toEqual(["winda: brak, piętra: brak danych"]);
    });

    it("reports a conflict on a missing lift when sources disagree on the storeys", () => {
      // GIVEN no lift and conflicting storey data
      const place = withoutLift({ attribute: "levels", state: "conflict", status: "conflict", value: null, facts: [] });
      // WHEN checked against the wheelchair preset
      // THEN the lift need is a conflict on the storeys, not a barrier
      expect(liftNeed(place)).toMatchObject({ attribute: "levels", state: "conflict", reason: "winda: brak, piętra: sprzeczne dane" });
      expect(matchProfile(place, wheelchair, "pl").state).toBe("conflict");
    });
  });

  it("never returns met when an attribute the profile doesn't need is in conflict", () => {
    // GIVEN a place that meets every wheelchair need but has conflicting surface data
    const place = {
      attributes: [
        ...fullyAccessible.attributes,
        { attribute: "surface" as const, state: "conflict" as const, status: "conflict" as const, value: null, facts: [] },
      ],
    };
    // WHEN checked against the wheelchair preset, which doesn't require a smooth surface
    const verdict = matchProfile(place, wheelchair, "pl");
    // THEN the verdict is conflict with a reason, not met
    expect(verdict.state).toBe("conflict");
    expect(verdict.reasons).toEqual(["sprzeczne dane o miejscu"]);
  });

  it("marks met as unconfirmed when it rests on unverified data", () => {
    // GIVEN the lift is only known from community data
    const place = {
      attributes: fullyAccessible.attributes.map((a) => (a.attribute === "lift" ? { ...a, status: "unverified" as const } : a)),
    };
    // WHEN checked
    const verdict = matchProfile(place, wheelchair, "pl");
    // THEN it is met but unconfirmed
    expect(verdict.state).toBe("met");
    expect(verdict.unconfirmed).toBe(true);
  });
});

const confirmed = { reliability: "confirmed", sourceId: "msip" } as const;

const wheelchairOk = (extra: Partial<AccessibilityFact> = {}): AccessibilityFact[] => [
  fact("step_count", numFact(0, "count"), extra),
  fact("threshold_cm", numFact(1), extra),
  fact("door_width_cm", numFact(100), extra),
  fact("lift", boolFact(true), extra),
  fact("toilet_accessible", boolFact(true), extra),
];

const match = (thresholds: Thresholds, facts: AccessibilityFact[]) =>
  matchProfile({ attributes: resolveAttributes(facts, NOW) }, thresholds, "pl");

describe("matchProfile with facts through the resolver", () => {
  it("never says met for a place with no data (US-3.4)", () => {
    // GIVEN a place without any facts
    // WHEN matching the wheelchair presets
    const verdict = match(wheelchair, []);
    // THEN it is unknown and every need lands in "Nie wiadomo"
    expect(verdict.state).toBe("unknown");
    expect(verdict.needs?.every((n) => n.state === "unknown")).toBe(true);
  });

  it("never says met when two sources disagree on a needed attribute (US-3.3)", () => {
    // GIVEN a toilet fact OSM and the city disagree on, everything else confirmed and passing
    const facts = [
      ...wheelchairOk(confirmed).filter((f) => f.attribute !== "toilet_accessible"),
      fact("toilet_accessible", boolFact(true), { sourceId: "osm" }),
      fact("toilet_accessible", boolFact(false), { sourceId: "msip", reliability: "confirmed" }),
    ];
    // WHEN matching
    const verdict = match(wheelchair, facts);
    // THEN the verdict is conflict
    expect(verdict.state).toBe("conflict");
    expect(verdict.needs?.find((n) => n.need === "toilet")?.state).toBe("conflict");
  });

  it("is met on confirmed facts and never on facts older than 12 months", () => {
    // GIVEN the same passing facts, fresh and last observed 13 months ago
    const fresh = wheelchairOk(confirmed);
    const old = wheelchairOk({ ...confirmed, observedAt: "2025-08-01T00:00:00Z" });
    // WHEN matching
    // THEN fresh data is met, old data is unknown
    expect(match(wheelchair, fresh)).toMatchObject({ state: "met", unconfirmed: false });
    expect(match(wheelchair, old).state).toBe("unknown");
  });

  it("keeps sample data unconfirmed in a met verdict", () => {
    // GIVEN every needed fact is sample data, even with many confirmations
    const facts = wheelchairOk({ reliability: "sample", evidence: { confirmations: 5 } });
    // WHEN matching
    // THEN it is met but unconfirmed
    expect(match(wheelchair, facts)).toMatchObject({ state: "met", unconfirmed: true });
  });

  it("treats OSM wheelchair=no as a barrier for a step-free entrance, and wheelchair=yes as not enough", () => {
    // GIVEN only OSM's overall wheelchair tag
    const no = [fact("wheelchair_overall", text("no"))];
    const yes = [fact("wheelchair_overall", text("yes"))];
    // WHEN matching the wheelchair and the stroller presets
    // THEN "no" blocks the wheelchair entrance only, and "yes" never makes a place met
    expect(match(wheelchair, no)).toMatchObject({ state: "barrier", blockers: ["wheelchair_overall"] });
    expect(match(stroller, no).state).toBe("unknown");
    expect(match(wheelchair, yes).state).toBe("unknown");
  });

  it("says the entrance has only OSM's overall tag when steps are unknown, without making it met", () => {
    // GIVEN OSM's overall "yes" or "limited" and no entrance details
    const yes = [fact("wheelchair_overall", text("yes"))];
    const limited = [fact("wheelchair_overall", text("limited"))];
    // WHEN matching the wheelchair preset
    const fromYes = match(wheelchair, yes);
    const fromLimited = match(wheelchair, limited);
    // THEN the entrance stays unknown and its reason names the overall tag instead of a bare "wejście"
    expect(fromYes.state).toBe("unknown");
    expect(fromYes.needs?.find((n) => n.need === "entrance")).toMatchObject({
      state: "unknown",
      reason: "wejście: ogólnie oznaczone jako dostępne, bez szczegółów",
    });
    expect(fromLimited.reasons).toContain("wejście: ogólnie oznaczone jako częściowo dostępne, bez szczegółów");
  });

  it("applies custom thresholds over the existing needs without code changes", () => {
    // GIVEN thresholds for a profile that only needs a step-free entrance and an 80 cm door
    const custom: Thresholds = {
      maxThresholdCm: 2,
      minDoorWidthCm: 80,
      requireStepFree: true,
      requireLift: false,
      requireAccessibleToilet: false,
      requireSmoothSurface: false,
      requireChangingTable: false,
      requireBench: false,
    };
    const facts = [
      fact("step_count", numFact(0, "count"), confirmed),
      fact("threshold_cm", numFact(0), confirmed),
      fact("door_width_cm", numFact(85), confirmed),
    ];
    // WHEN matching
    // THEN the same matcher applies it without code changes
    expect(match(custom, facts)).toMatchObject({ state: "met", unconfirmed: false });
    expect(match(wheelchair, facts).state).toBe("barrier");
  });
});

describe("the senior preset, a profile added only as configuration", () => {
  // US-2.8: no steps, a lift and somewhere to rest — no matcher change, just thresholds.
  const senior = PROFILE_PRESETS.senior;
  const restful = (bench: AccessibilityFact[]) => [
    fact("step_count", numFact(0, "count"), confirmed),
    fact("threshold_cm", numFact(2), confirmed),
    fact("door_width_cm", numFact(80), confirmed),
    fact("lift", boolFact(true), confirmed),
    ...bench,
  ];

  it("is met with a step-free entrance, a lift and a bench, and lists the bench as a need", () => {
    // GIVEN a place with a step-free entrance, a lift and a confirmed bench, but no accessible toilet
    const facts = [...restful([fact("bench", boolFact(true), confirmed)]), fact("toilet_accessible", boolFact(false), confirmed)];
    // WHEN matched against the senior preset
    const verdict = match(senior, facts);
    // THEN it is met, and the needs are the entrance, the door, the lift and the bench only
    expect(verdict).toMatchObject({ state: "met", unconfirmed: false, reasons: [] });
    expect(verdict.needs?.map((n) => n.need)).toEqual(["entrance", "door", "lift", "bench"]);
  });

  it("is blocked by a known missing bench and can't say without bench data", () => {
    // GIVEN the same place once with no bench and once without any bench data
    const noBench = restful([fact("bench", boolFact(false), confirmed)]);
    const noData = restful([]);
    // WHEN matched against the senior preset
    // THEN a missing bench blocks with its reason, missing data is unknown, never met
    expect(match(senior, noBench)).toMatchObject({ state: "barrier", blockers: ["bench"], reasons: ["ławka: brak"] });
    expect(match(senior, noData)).toMatchObject({ state: "unknown", unknowns: ["bench"], reasons: ["ławka"] });
  });

  it("is blocked by steps without a ramp, like the wheelchair preset", () => {
    // GIVEN two steps and no ramp, with a lift and a bench
    const facts = [
      fact("step_count", numFact(2, "count"), confirmed),
      fact("ramp", boolFact(false), confirmed),
      fact("door_width_cm", numFact(80), confirmed),
      fact("lift", boolFact(true), confirmed),
      fact("bench", boolFact(true), confirmed),
    ];
    // WHEN matched against the senior preset
    // THEN the steps block the entrance
    expect(match(senior, facts)).toMatchObject({ state: "barrier", blockers: ["step_count"], reasons: ["2 stopnie"] });
  });
});

describe("thresholdsFor", () => {
  it("returns null without a profile and fills missing thresholds from the presets", () => {
    // GIVEN queries without a profile and with one overridden threshold
    // WHEN thresholds are derived
    // THEN thresholds are ignored without a profile, and the override wins over the preset
    expect(thresholdsFor({ maxThresholdCm: 5 })).toBeNull();
    expect(thresholdsFor({ profile: "stroller", minDoorWidthCm: 60 })).toEqual({ ...stroller, minDoorWidthCm: 60 });
    expect(thresholdsFor({ profile: "wheelchair", requireBench: true, requireLift: false })).toEqual({
      ...wheelchair,
      requireBench: true,
      requireLift: false,
    });
  });
});
