import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Place } from "@krakow-bez-barier/contracts";
import { factViews, osmEditUrl } from "./place-facts";
import { ownEntries, pendingEntries, reportInput, withPending, type PendingEntry } from "./reports";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: createMockFetch() });

async function demoPlace(id: string): Promise<Place> {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example for ${id}`);
  return data;
}

const report = (attribute: PendingEntry["attribute"], valueText: string): PendingEntry => ({
  key: `k-${attribute}`,
  kind: "report",
  mine: true,
  attribute,
  valueText,
  createdAt: "2026-10-03T09:12:00Z",
  sending: false,
});

describe("withPending", () => {
  it("shows the visitor's report beside the fact without changing its value or reliability", async () => {
    // GIVEN the conflicting demo place and a pending report that the toilet is accessible
    const views = factViews(await demoPlace("palac-krzysztofory"), "pl");
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

describe("pendingEntries", () => {
  const served = (place: Place): Place => ({
    ...place,
    attributes: place.attributes.map((a) =>
      a.attribute === "lift"
        ? {
            ...a,
            pendingReports: [
              { id: "r-other", value: { kind: "boolean", boolean: false }, comment: "winda nie działa", status: "new", createdAt: "2026-10-02T08:00:00Z" },
              { id: "r-mine", value: { kind: "boolean", boolean: false }, comment: null, status: "needs_info", createdAt: "2026-10-03T09:12:00Z" },
            ],
          }
        : a,
    ),
  });

  it("lists other devices' reports, then this device's own entries, each report once", async () => {
    // GIVEN the API lists two lift reports, one of them this device's, and a bench report still in the undo window
    const place = served(await demoPlace("palac-krzysztofory"));
    const own = ownEntries(
      [{ kind: "report", id: "r-mine", attribute: "lift", value: { kind: "boolean", boolean: false }, factId: null, createdAt: "2026-10-03T09:12:00Z" }],
      [{ ...report("bench", "Jest"), key: "k-queued", sending: true }],
      "pl",
    );

    // WHEN the card's pending entries are built
    const entries = pendingEntries(place, own, "pl");

    // THEN the other device's report comes first with its value as text, and the own ones are marked and not repeated
    expect(entries.map((e) => [e.key, e.attribute, e.mine, e.valueText])).toEqual([
      ["r-other", "lift", false, "Nie ma"],
      ["r-mine", "lift", true, "Nie ma"],
      ["k-queued", "bench", true, "Jest"],
    ]);
    expect(entries[0]).toMatchObject({ createdAt: "2026-10-02T08:00:00Z", sending: false });
    // AND an unmoderated comment is not passed on to the card
    expect(entries[0]).not.toHaveProperty("comment");
  });

  it("hides this device's served report while a change of it is being sent", async () => {
    // GIVEN the device's lift report is listed, and a new lift report from the device is in the undo window
    const place = served(await demoPlace("palac-krzysztofory"));
    const listed = { kind: "report" as const, id: "r-mine", attribute: "lift" as const, value: { kind: "boolean" as const, boolean: false }, factId: null, createdAt: "2026-10-03T09:12:00Z" };
    const changing = { ...report("lift", "Jest"), key: "k-change", sending: true };

    // WHEN the card's pending entries are built
    const entries = pendingEntries(place, ownEntries([listed], [changing], "pl"), "pl");

    // THEN the lift shows the other device's report and only the change as this device's
    expect(entries.map((e) => [e.key, e.mine, e.valueText])).toEqual([
      ["r-other", false, "Nie ma"],
      ["k-change", true, "Jest"],
    ]);
  });
});

describe("ownEntries", () => {
  it("keeps one entry per attribute, a confirmation with the value it confirmed", () => {
    // GIVEN the API lists this device's confirmation of the steps and its report of the lift
    const contributions = [
      { kind: "confirmation" as const, id: "c1", attribute: "step_count" as const, value: { kind: "number" as const, number: 0, unit: "count" as const }, factId: "f1", createdAt: "2026-10-03T09:00:00Z" },
      { kind: "report" as const, id: "r1", attribute: "lift" as const, value: { kind: "boolean" as const, boolean: false }, factId: null, createdAt: "2026-10-03T09:05:00Z" },
    ];

    // WHEN building the device's entries
    const entries = ownEntries(contributions, [], "pl");

    // THEN each attribute has one entry of its kind, the report carrying its id
    expect(entries.map((e) => [e.attribute, e.kind, e.mine, e.reportId])).toEqual([
      ["step_count", "confirmation", true, undefined],
      ["lift", "report", true, "r1"],
    ]);
  });
});

describe("reportInput", () => {
  it("asks for a number within the contract's range for measured attributes", () => {
    // GIVEN door width, which the contract bounds to 10–300 cm
    // WHEN building its input
    // THEN it is a number field with that range
    expect(reportInput("door_width_cm", "pl")).toEqual({ kind: "number", range: { min: 10, max: 300, unit: "cm" } });
  });

  it("offers typed choices for yes/no and surface attributes", () => {
    // GIVEN a yes/no attribute, the OSM overall tag and the surface attribute
    const ramp = reportInput("ramp", "pl");
    const surface = reportInput("surface", "pl");

    // WHEN reading their options
    // THEN they carry FactValues of the right kind
    expect(ramp.kind === "choice" && ramp.options.map((o) => o.value)).toEqual([
      { kind: "boolean", boolean: true },
      { kind: "boolean", boolean: false },
    ]);
    const overall = reportInput("wheelchair_overall", "pl");
    expect(overall.kind === "choice" && overall.options.map((o) => [o.label, o.value])).toEqual([
      ["Dostępne dla wózków", { kind: "text", text: "yes" }],
      ["Częściowo dostępne dla wózków", { kind: "text", text: "limited" }],
      ["Niedostępne dla wózków", { kind: "text", text: "no" }],
    ]);
    expect(surface.kind === "choice" && surface.options.find((o) => o.id === "cobblestone")).toMatchObject({
      label: "kostka brukowa",
      value: { kind: "text", text: "cobblestone" },
    });
  });
});

describe("confirm and OSM edit targets", () => {
  it("lets visitors confirm only a single known fact, and links to the OSM object", async () => {
    // GIVEN the conflicting demo place (steps known from osm:node/123456@v21, toilet in conflict)
    const place = await demoPlace("palac-krzysztofory");

    // WHEN building the rows and the OSM link
    const rows = factViews(place, "pl");

    // THEN the known fact can be confirmed by id, the conflicting and unknown ones cannot
    expect(rows.find((r) => r.attribute === "step_count")?.confirmFactId).toBe("fact_osm_krzysztofory_steps");
    expect(rows.find((r) => r.attribute === "toilet_accessible")?.confirmFactId).toBeUndefined();
    expect(rows.find((r) => r.attribute === "lift")?.confirmFactId).toBeUndefined();
    // AND the edit link points at the OSM object, built from the OSM source's URL
    expect(osmEditUrl(place)).toBe("https://www.openstreetmap.org/edit?node=123456");
  });
});
