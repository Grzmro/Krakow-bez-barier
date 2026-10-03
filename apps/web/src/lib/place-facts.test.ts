import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Place } from "@krakow-bez-barier/contracts";
import { factViews, failedSources, formatValue, latestSourceDate } from "./place-facts";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: createMockFetch() });

async function demoPlace(id: string): Promise<Place> {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example for ${id}`);
  return data;
}

describe("factViews", () => {
  it("shows both conflicting values with their sources and keeps unknowns named", async () => {
    // GIVEN the conflicting demo place (toilet differs between MSIP and OSM, lift unknown)
    const place = await demoPlace("palac-krzysztofory");

    // WHEN it is turned into card rows
    const rows = factViews(place, "pl");
    const toilet = rows.find((r) => r.attribute === "toilet_accessible");
    const lift = rows.find((r) => r.attribute === "lift");

    // THEN the toilet row carries both values and both sources, flagged as a conflict
    expect(toilet).toMatchObject({ value: "Jest / Nie ma", reliability: "conflict", conflict: true });
    expect(toilet?.sources.map((s) => [s.name, s.value])).toEqual([
      ["MSIP: Toalety publiczne", "Jest"],
      ["OpenStreetMap", "Nie ma"],
    ]);
    // AND the stale MSIP fact says it may be outdated, with its date
    expect(toilet?.sources[0].staleNote).toBe("Może być nieaktualne · 8.11.2023");
    // AND missing data is named, not hidden or treated as accessible
    expect(lift).toMatchObject({ unknown: true, reliability: "unknown" });
    expect(lift?.value).toBeUndefined();
  });

  it("drops step height and ramp when the entrance is known to be step-free", async () => {
    // GIVEN a place with step_count = 0 and no ramp or step-height facts
    const place = await demoPlace("palac-krzysztofory");

    // WHEN it is turned into card rows
    const attributes = factViews(place, "pl").map((r) => r.attribute);

    // THEN the moot rows are gone and the step-free entrance is shown as text
    expect(attributes).not.toContain("ramp");
    expect(attributes).not.toContain("step_height_cm");
    expect(factViews(place, "pl")[0]).toMatchObject({ attribute: "step_count", value: "Bez stopni", reliability: "confirmed" });
  });

  it("lists every card attribute as unknown for a place without data", async () => {
    // GIVEN the incomplete demo place
    const place = await demoPlace("kawiarnia-przyklad");

    // WHEN it is turned into card rows
    const rows = factViews(place, "pl");

    // THEN every row is an explicit "no data"
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.unknown && r.sources.length === 0)).toBe(true);
  });

  it("marks outdated facts as outdated with the original date", async () => {
    // GIVEN the outdated demo place (ramp from a 2022 declaration)
    const place = await demoPlace("teatr-slowackiego");

    // WHEN it is turned into card rows
    const ramp = factViews(place, "pl").find((r) => r.attribute === "ramp");

    // THEN the value is kept but flagged
    expect(ramp).toMatchObject({ value: "Jest", reliability: "outdated" });
    expect(ramp?.sources[0].staleNote).toBe("Może być nieaktualne · 10.05.2022");
  });
});

describe("formatValue", () => {
  it("formats counts, units and controlled text values in Polish", () => {
    // GIVEN typed values
    // WHEN formatted
    // THEN numbers keep their unit and words are translated
    expect(formatValue("step_count", { kind: "number", number: 3, unit: "count" }, "pl")).toEqual({ value: "3 stopnie" });
    expect(formatValue("step_count", { kind: "number", number: 5, unit: "count" }, "pl")).toEqual({ value: "5 stopni" });
    expect(formatValue("door_width_cm", { kind: "number", number: 80, unit: "cm" }, "pl")).toEqual({ value: "80", unit: "cm" });
    expect(formatValue("incline_pct", { kind: "number", number: 6.5, unit: "pct" }, "pl")).toEqual({ value: "6,5", unit: "%" });
    expect(formatValue("surface", { kind: "text", text: "cobblestone" }, "pl")).toEqual({ value: "kostka brukowa" });
    expect(formatValue("surface", { kind: "text", text: "lava" }, "pl")).toEqual({ value: "lava" });
  });
});

describe("sources", () => {
  it("finds the failed source and the latest successful fetch", async () => {
    // GIVEN the conflicting demo place, whose MSIP source is in outage
    const place = await demoPlace("palac-krzysztofory");

    // WHEN its sources are inspected
    // THEN MSIP is the failed one and OSM's fetch is the latest
    expect(failedSources(place).map((s) => s.id)).toEqual(["msip-toilets"]);
    expect(latestSourceDate(place)).toBe("2026-10-03T03:00:00Z");
  });
});
