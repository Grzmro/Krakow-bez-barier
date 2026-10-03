import { describe, expect, it } from "vitest";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { bestDocumented } from "./showcase-place";

type Chip = PlaceSummary["summary"][number];
const chip = (state: Chip["state"]): Chip => ({ attribute: "wheelchair_overall", state, status: state === "unknown" ? "no_data" : "unverified" });
const place = (id: string, states: Chip["state"][], isSample = false) => ({ id, isSample, summary: states.map(chip) });

describe("bestDocumented", () => {
  it("picks the place with the most attributes that have data, not the first one", () => {
    // GIVEN a nearest place with no data and a farther one with two known attributes
    const places = [place("007", ["unknown", "unknown"]), place("qubus", ["known", "conflict", "unknown"])];

    // WHEN choosing the place to show
    const best = bestDocumented(places);

    // THEN the documented one wins, and "unknown" chips don't count as data
    expect(best?.id).toBe("qubus");
  });

  it("keeps the list order on a tie, so the nearest of equally documented places wins", () => {
    // GIVEN two places with the same amount of data
    const places = [place("near", ["known"]), place("far", ["stale"])];

    // WHEN choosing
    // THEN the first in the list (nearest) is kept
    expect(bestDocumented(places)?.id).toBe("near");
  });

  it("prefers real data over a sample place, however much the sample has", () => {
    // GIVEN a fully filled sample place and a real place with a single fact
    const places = [place("hotel-przyklad", ["known", "known", "known"], true), place("miodowa", ["known"])];

    // WHEN choosing
    // THEN the real place wins; a sample is shown only when there is nothing else
    expect(bestDocumented(places)?.id).toBe("miodowa");
    expect(bestDocumented([places[0]!])?.id).toBe("hotel-przyklad");
  });

  it("returns undefined for an empty list", () => {
    // GIVEN no places
    // WHEN choosing
    // THEN there is nothing to show
    expect(bestDocumented([])).toBeUndefined();
  });
});
