import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Place } from "@krakow-bez-barier/contracts";
import { factViews, osmEditUrl } from "./place-facts";
import { reportInput, withPending, type PendingEntry } from "./reports";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: createMockFetch() });

async function demoPlace(id: string): Promise<Place> {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example for ${id}`);
  return data;
}

const report = (attribute: PendingEntry["attribute"], valueText: string): PendingEntry => ({
  key: `k-${attribute}`,
  kind: "report",
  attribute,
  valueText,
  createdAt: "2026-10-03T09:12:00Z",
  sending: false,
});

describe("withPending", () => {
  it("shows the visitor's report beside the fact without changing its value or reliability", async () => {
    // GIVEN the conflicting demo place and a pending report that the toilet is accessible
    const views = factViews(await demoPlace("palac-krzysztofory"));
    const pending = [report("toilet_accessible", "Jest"), report("lift", "Jest")];

    // WHEN the report is attached to the card rows
    const rows = withPending(views, pending);

    // THEN every row keeps exactly what the API resolved — the conflict stays a conflict, unknown stays unknown
    for (const [i, row] of rows.entries()) expect(row).toEqual({ ...views[i], pending: row.pending });
    // AND the report is listed only under its own attribute
    expect(rows.find((r) => r.attribute === "toilet_accessible")?.pending).toEqual([pending[0]]);
    expect(rows.find((r) => r.attribute === "lift")?.pending).toEqual([pending[1]]);
    expect(rows.find((r) => r.attribute === "step_count")?.pending).toEqual([]);
  });
});

describe("reportInput", () => {
  it("asks for a number within the contract's range for measured attributes", () => {
    // GIVEN door width, which the contract bounds to 40–300 cm
    // WHEN building its input
    // THEN it is a number field with that range
    expect(reportInput("door_width_cm")).toEqual({ kind: "number", range: { min: 40, max: 300, unit: "cm" } });
  });

  it("offers typed choices for yes/no and surface attributes", () => {
    // GIVEN a yes/no attribute and the surface attribute
    const ramp = reportInput("ramp");
    const surface = reportInput("surface");

    // WHEN reading their options
    // THEN they carry FactValues of the right kind
    expect(ramp.kind === "choice" && ramp.options.map((o) => o.value)).toEqual([
      { kind: "boolean", boolean: true },
      { kind: "boolean", boolean: false },
    ]);
    expect(surface.kind === "choice" && surface.options.find((o) => o.id === "cobblestone")).toMatchObject({
      label: "kostka brukowa",
      value: { kind: "text", text: "cobblestone" },
    });
  });
});

describe("confirm and OSM edit targets", () => {
  it("lets visitors confirm only a single known fact, and links to the OSM object", async () => {
    // GIVEN the conflicting demo place (steps known from OSM node/123456, toilet in conflict)
    const place = await demoPlace("palac-krzysztofory");

    // WHEN building the rows and the OSM link
    const rows = factViews(place);

    // THEN the known fact can be confirmed by id, the conflicting and unknown ones cannot
    expect(rows.find((r) => r.attribute === "step_count")?.confirmFactId).toBe("fact_osm_krzysztofory_steps");
    expect(rows.find((r) => r.attribute === "toilet_accessible")?.confirmFactId).toBeUndefined();
    expect(rows.find((r) => r.attribute === "lift")?.confirmFactId).toBeUndefined();
    // AND the edit link points at the OSM object, built from the OSM source's URL
    expect(osmEditUrl(place)).toBe("https://www.openstreetmap.org/edit?node=123456");
  });
});
