import { describe, expect, it } from "vitest";
import type { Outage, Place, ResolvedAttribute } from "@krakow-bez-barier/contracts";
import { NOW } from "./fixtures";
import { matchProfile } from "./matcher";
import { activeOutages, canReportOutage, isOutageEquipment, outageExpiresAt, outageState, type OutageRecord } from "./outages";
import { PROFILE_PRESETS } from "./profiles";

const RULES = { confirmationsToConfirm: 2, workingVotesToResolve: 1, expiresAfterHours: 48 };
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

function outage(overrides: Partial<OutageRecord> = {}): OutageRecord {
  return {
    id: "out-1",
    placeId: "place-1",
    equipment: "lift",
    reportedAt: ago(1),
    confirmations: 0,
    lastConfirmedAt: ago(1),
    workingVotes: 0,
    ...overrides,
  };
}

describe("outageState", () => {
  it("is reported until enough visitors confirm it, then confirmed", () => {
    // GIVEN an outage with 0, 1 and 2 confirmations
    // WHEN its state is read
    // THEN it is reported below the threshold and confirmed at it
    expect(outageState(outage(), NOW, RULES)).toBe("reported");
    expect(outageState(outage({ confirmations: 1 }), NOW, RULES)).toBe("reported");
    expect(outageState(outage({ confirmations: 2 }), NOW, RULES)).toBe("confirmed");
  });

  it("is resolved once someone says it works, even after confirmations", () => {
    // GIVEN a confirmed outage that a visitor marked as working
    const record = outage({ confirmations: 3, workingVotes: 1 });
    // WHEN its state is read
    // THEN it is resolved
    expect(outageState(record, NOW, RULES)).toBe("resolved");
  });

  it("expires when nobody confirms it for the configured time, counted from the last confirmation", () => {
    // GIVEN an outage reported 50 hours ago, unconfirmed, and another confirmed 10 hours ago
    const stale = outage({ reportedAt: ago(50), lastConfirmedAt: ago(50) });
    const refreshed = outage({ reportedAt: ago(50), lastConfirmedAt: ago(10), confirmations: 1 });
    // WHEN their state is read
    // THEN the first expired at reported + 48 h, the second still counts
    expect(outageState(stale, NOW, RULES)).toBe("expired");
    expect(outageExpiresAt(stale, RULES)).toEqual(ago(2));
    expect(outageState(refreshed, NOW, RULES)).toBe("reported");
    expect(outageState(outage({ lastConfirmedAt: ago(48) }), NOW, RULES)).toBe("expired");
  });

  it("is removed while a moderator's removal holds, and counts again once a time-limited one ends", () => {
    // GIVEN a confirmed outage removed for good, and one whose removal ended an hour ago
    const lasting = outage({ confirmations: 2, removedAt: ago(1), removalEndsAt: null });
    const lapsed = outage({ confirmations: 2, removedAt: ago(1), removalEndsAt: ago(0.5) });
    // WHEN their state is read
    // THEN the first is removed and leaves the active list; the second is confirmed again
    expect(outageState(lasting, NOW, RULES)).toBe("removed");
    expect(activeOutages([lasting], NOW, RULES)).toEqual([]);
    expect(outageState(lapsed, NOW, RULES)).toBe("confirmed");
  });
});

describe("activeOutages", () => {
  it("lists only reported and confirmed outages, newest first", () => {
    // GIVEN an older and a newer active outage, a resolved and an expired one
    const records = [
      outage({ id: "older", reportedAt: ago(5), lastConfirmedAt: ago(5) }),
      outage({ id: "resolved", workingVotes: 1 }),
      outage({ id: "newer", equipment: "ramp", reportedAt: ago(1), lastConfirmedAt: ago(1) }),
      outage({ id: "expired", reportedAt: ago(60), lastConfirmedAt: ago(60) }),
    ];
    // WHEN the active ones are listed
    const listed = activeOutages(records, NOW, RULES);
    // THEN only the two active ones remain, newest first, with their expiry
    expect(listed.map((o) => o.id)).toEqual(["newer", "older"]);
    expect(listed[1]).toMatchObject({ state: "reported", expiresAt: new Date(ago(5).getTime() + 48 * HOUR).toISOString() });
  });

  it("knows which attributes can have an outage", () => {
    // GIVEN the attribute vocabulary
    // WHEN checking a lift, a ramp and a door
    // THEN only the lift and the ramp can be reported broken
    expect(["lift", "ramp", "door_width_cm"].map(isOutageEquipment)).toEqual([true, true, false]);
  });
});

describe("canReportOutage", () => {
  it("offers a report for a lift that exists or is unknown, never for one the facts say is missing", () => {
    // GIVEN places with a lift, without one, with an unknown lift and with a ramp nobody described
    const withLift = { attributes: [known("lift", bool(true))] };
    const noLift = { attributes: [known("lift", bool(false))] };
    const staleNoLift = { attributes: [{ ...known("lift", bool(false)), state: "stale" as const }] };
    const unknown: Pick<Place, "attributes"> = { attributes: [] };
    // WHEN checking whether the lift (or a door) can be reported broken
    // THEN only a lift that is not known to be missing can be
    expect(canReportOutage(withLift, "lift")).toBe(true);
    expect(canReportOutage(noLift, "lift")).toBe(false);
    expect(canReportOutage(staleNoLift, "lift")).toBe(false);
    expect(canReportOutage(unknown, "lift")).toBe(true);
    expect(canReportOutage(unknown, "ramp")).toBe(true);
    expect(canReportOutage(withLift, "door_width_cm")).toBe(false);
  });
});

function known(attribute: ResolvedAttribute["attribute"], value: ResolvedAttribute["value"]): ResolvedAttribute {
  return { attribute, state: "known", status: "confirmed", value, facts: [] };
}
const num = (number: number) => ({ kind: "number" as const, number });
const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });

const accessible: Pick<Place, "attributes"> = {
  attributes: [
    known("step_count", num(0)),
    known("threshold_cm", num(1)),
    known("door_width_cm", num(90)),
    known("lift", bool(true)),
    known("levels", num(3)),
    known("toilet_accessible", bool(true)),
  ],
};

const listed = (overrides: Partial<Outage> = {}): Outage => ({
  id: "out-1",
  equipment: "lift",
  reliability: "user_report",
  state: "reported",
  confirmations: 0,
  workingVotes: 0,
  reportedAt: ago(1).toISOString(),
  lastConfirmedAt: ago(1).toISOString(),
  expiresAt: ago(-47).toISOString(),
  ...overrides,
});

describe("matchProfile with outages", () => {
  it("makes a reported lift outage an unconfirmed barrier", () => {
    // GIVEN a place that meets the wheelchair profile, with its lift reported broken
    const place = { ...accessible, outages: [listed()] };
    // WHEN it is checked against the wheelchair presets
    const verdict = matchProfile(place, PROFILE_PRESETS.wheelchair, "pl");
    // THEN the lift blocks, marked as an unconfirmed outage, and so does the verdict
    expect(verdict).toMatchObject({ state: "barrier", unconfirmed: true, blockers: ["lift"], reasons: ["zgłoszona awaria windy"] });
    expect(verdict.needs?.find((n) => n.need === "lift")).toMatchObject({ state: "barrier", outage: true, unconfirmed: true });
  });

  it("drops the unconfirmed note once the community confirms the outage", () => {
    // GIVEN the same place with the outage confirmed by the community
    const place = { ...accessible, outages: [listed({ state: "confirmed", confirmations: 2 })] };
    // WHEN it is checked
    const verdict = matchProfile(place, PROFILE_PRESETS.wheelchair, "en");
    // THEN it is a plain barrier
    expect(verdict).toMatchObject({ state: "barrier", unconfirmed: false, reasons: ["lift reported out of order"] });
  });

  it("keeps the verdict confirmed when another barrier is known for sure", () => {
    // GIVEN a narrow door and a reported lift outage
    const place = {
      attributes: accessible.attributes.map((a) => (a.attribute === "door_width_cm" ? known("door_width_cm", num(70)) : a)),
      outages: [listed()],
    };
    // WHEN it is checked
    const verdict = matchProfile(place, PROFILE_PRESETS.wheelchair, "pl");
    // THEN the barrier doesn't rest on the outage alone, so it is not marked unconfirmed
    expect(verdict).toMatchObject({ state: "barrier", unconfirmed: false, blockers: ["door_width_cm", "lift"] });
  });

  it("blocks an entrance that relies on a broken ramp, and ignores outages that don't matter", () => {
    // GIVEN two steps with a ramp reported broken, and a single-storey place with its lift reported broken
    const ramped = {
      attributes: [known("step_count", num(2)), known("ramp", bool(true)), known("door_width_cm", num(90))],
      outages: [listed({ equipment: "ramp" })],
    };
    const oneStorey = {
      attributes: accessible.attributes.map((a) => (a.attribute === "levels" ? known("levels", num(1)) : a)),
      outages: [listed()],
    };
    // WHEN they are checked against the stroller presets
    // THEN the ramp blocks the entrance, while one storey needs no lift at all
    expect(matchProfile(ramped, PROFILE_PRESETS.stroller, "pl").needs?.find((n) => n.need === "entrance")).toMatchObject({
      state: "barrier",
      attribute: "ramp",
      reason: "zgłoszona awaria podjazdu",
    });
    expect(matchProfile(oneStorey, PROFILE_PRESETS.stroller, "pl").needs?.find((n) => n.need === "lift")?.state).toBe("met");
  });

  it("ignores resolved and expired outages", () => {
    // GIVEN outages that are no longer active
    const place = { ...accessible, outages: [listed({ state: "resolved" }), listed({ id: "out-2", state: "expired" })] };
    // WHEN the place is checked
    // THEN it meets the profile as before
    expect(matchProfile(place, PROFILE_PRESETS.wheelchair, "pl").state).toBe("met");
  });
});
