import { describe, expect, it } from "vitest";
import { bool, fact, NOW, num, text } from "./fixtures";
import { resolveAttribute } from "./resolver";

describe("resolveAttribute", () => {
  it("is unknown with status no_data when there are no facts", () => {
    // GIVEN no facts for the attribute
    // WHEN resolving it
    const result = resolveAttribute("lift", [], NOW);
    // THEN it is unknown and carries no value
    expect(result).toMatchObject({ state: "unknown", status: "no_data", value: null, facts: [] });
  });

  it("ignores facts of other attributes and superseded facts", () => {
    // GIVEN a superseded lift fact and a ramp fact
    const facts = [fact("lift", bool(true), { status: "superseded" }), fact("ramp", bool(true))];
    // WHEN resolving lift
    const result = resolveAttribute("lift", facts, NOW);
    // THEN there is no data
    expect(result.state).toBe("unknown");
  });

  it("is known and unverified for a single community fact", () => {
    // GIVEN one fresh OSM fact
    // WHEN resolving
    const result = resolveAttribute("door_width_cm", [fact("door_width_cm", num(95))], NOW);
    // THEN the value is known but not confirmed
    expect(result).toMatchObject({ state: "known", status: "unverified", value: num(95) });
  });

  it("is confirmed when the best fact comes from a confirmed source", () => {
    // GIVEN a confirmed-reliability fact
    const f = fact("ramp", bool(true), { reliability: "confirmed", sourceId: "msip" });
    // WHEN resolving
    // THEN the status is confirmed
    expect(resolveAttribute("ramp", [f], NOW).status).toBe("confirmed");
  });

  it("becomes confirmed by the community after two confirmations, not after one", () => {
    // GIVEN user-report facts with 1 and 2 confirmations
    const one = fact("ramp", bool(true), { reliability: "user_report", evidence: { confirmations: 1 } });
    const two = fact("ramp", bool(true), { reliability: "user_report", evidence: { confirmations: 2 } });
    // WHEN resolving each
    // THEN only the second is confirmed
    expect(resolveAttribute("ramp", [one], NOW).status).toBe("unverified");
    expect(resolveAttribute("ramp", [two], NOW).status).toBe("confirmed");
  });

  it("reports a conflict with every fact and no winning value", () => {
    // GIVEN two sources that disagree
    const facts = [
      fact("changing_table", bool(true), { sourceId: "osm" }),
      fact("changing_table", bool(false), { sourceId: "msip", reliability: "confirmed" }),
    ];
    // WHEN resolving
    const result = resolveAttribute("changing_table", facts, NOW);
    // THEN it is a conflict, not settled by reliability
    expect(result).toMatchObject({ state: "conflict", status: "conflict", value: null });
    expect(result.facts).toHaveLength(2);
  });

  it("treats a user report that contradicts a confirmed fact as a conflict", () => {
    // GIVEN a confirmed fact and a contradicting unverified report
    const facts = [
      fact("lift", bool(true), { reliability: "confirmed", sourceId: "msip" }),
      fact("lift", bool(false), { reliability: "user_report", sourceId: "report" }),
    ];
    // WHEN resolving
    // THEN the report is shown next to the value instead of silently replacing or losing to it
    expect(resolveAttribute("lift", facts, NOW).state).toBe("conflict");
  });

  it("does not report a conflict between fresh facts that agree", () => {
    // GIVEN two sources with the same value
    const facts = [
      fact("ramp", bool(true), { sourceId: "osm" }),
      fact("ramp", bool(true), { sourceId: "msip", reliability: "confirmed" }),
    ];
    // WHEN resolving
    const result = resolveAttribute("ramp", facts, NOW);
    // THEN the value is known and the most reliable source decides the status
    expect(result).toMatchObject({ state: "known", status: "confirmed" });
  });

  it("marks a fact older than 12 months as stale", () => {
    // GIVEN a fact last observed 13 months ago
    const f = fact("ramp", bool(true), { observedAt: "2025-08-01T00:00:00Z" });
    // WHEN resolving
    const result = resolveAttribute("ramp", [f], NOW);
    // THEN the state is stale and the status outdated
    expect(result).toMatchObject({ state: "stale", status: "outdated" });
  });

  it("dates a fact by its latest confirmation, not by when it was fetched", () => {
    // GIVEN an old observation that was confirmed last month
    const f = fact("ramp", bool(true), { observedAt: "2024-01-01T00:00:00Z", confirmedAt: "2026-09-01T00:00:00Z" });
    // WHEN resolving
    // THEN it is fresh
    expect(resolveAttribute("ramp", [f], NOW).state).toBe("known");
  });

  it("marks a fact stale when its source failed to refresh", () => {
    // GIVEN a recent fact flagged stale by ingestion
    const f = fact("ramp", bool(true), { stale: true });
    // WHEN resolving
    // THEN it is stale
    expect(resolveAttribute("ramp", [f], NOW).state).toBe("stale");
  });

  it("lets a fresh fact win over a disagreeing stale one without a conflict", () => {
    // GIVEN an outdated declaration and a fresh OSM fact that disagree
    const facts = [
      fact("ramp", bool(true), { sourceId: "decl", observedAt: "2022-05-10T00:00:00Z" }),
      fact("ramp", bool(false), { sourceId: "osm" }),
    ];
    // WHEN resolving
    const result = resolveAttribute("ramp", facts, NOW);
    // THEN the fresh value is known and both facts stay visible
    expect(result).toMatchObject({ state: "known", value: bool(false) });
    expect(result.facts).toHaveLength(2);
  });

  it("picks the most reliable, then the newest fact as the winner", () => {
    // GIVEN two agreeing text facts of different reliability
    const facts = [
      fact("surface", text("flat"), { sourceId: "a", observedAt: "2026-09-20T00:00:00Z" }),
      fact("surface", text("flat"), { sourceId: "b", reliability: "confirmed", observedAt: "2026-01-01T00:00:00Z" }),
    ];
    // WHEN resolving
    // THEN the confirmed fact is listed first
    expect(resolveAttribute("surface", facts, NOW).facts[0].source.id).toBe("b");
  });

  it("never promotes sample facts to confirmed through confirmations", () => {
    // GIVEN a sample fact with 3 confirmations
    const f = fact("ramp", bool(true), { reliability: "sample", evidence: { confirmations: 3 } });
    // WHEN resolving
    // THEN it stays unverified
    expect(resolveAttribute("ramp", [f], NOW).status).toBe("unverified");
  });

  it("counts the highest confirmation count among agreeing facts", () => {
    // GIVEN the most reliable fact has none, an agreeing report has two
    const facts = [
      fact("ramp", bool(true), { sourceId: "osm" }),
      fact("ramp", bool(true), { sourceId: "report", reliability: "user_report", evidence: { confirmations: 2 } }),
    ];
    // WHEN resolving
    // THEN the value is confirmed by the community
    expect(resolveAttribute("ramp", facts, NOW).status).toBe("confirmed");
  });

  it("treats an unparsable date as stale and ignores future dates", () => {
    // GIVEN a fact with a broken date and one observed in the future
    const broken = fact("ramp", bool(true), { observedAt: "not-a-date" });
    const future = fact("lift", bool(true), { observedAt: "2030-01-01T00:00:00Z" });
    // WHEN resolving
    // THEN the broken one is stale and the future one is fresh but not immortal
    expect(resolveAttribute("ramp", [broken], NOW).state).toBe("stale");
    expect(resolveAttribute("lift", [future], NOW).state).toBe("known");
  });

  it("computes the 12-month limit on UTC calendar months", () => {
    // GIVEN now is 29 Feb 2028 and a fact observed on 1 Mar 2027 / 28 Feb 2027
    const now = new Date("2028-02-29T12:00:00Z");
    const fresh = fact("ramp", bool(true), { observedAt: "2027-03-01T00:00:00Z" });
    const old = fact("lift", bool(true), { observedAt: "2027-02-27T00:00:00Z" });
    // WHEN resolving
    // THEN 1 Mar 2027 is within 12 months and 27 Feb 2027 is not
    expect(resolveAttribute("ramp", [fresh], now).state).toBe("known");
    expect(resolveAttribute("lift", [old], now).state).toBe("stale");
  });
});
