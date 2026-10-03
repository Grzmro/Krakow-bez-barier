import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Place } from "@krakow-bez-barier/contracts";
import { factViews, osmEditUrl } from "./place-facts";
import { pendingEntries, reportInput, withPending, type PendingEntry } from "./reports";

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

  it("lists every report the API serves, and this visitor's own ones once, as theirs", async () => {
    // GIVEN the API lists two lift reports, one of them sent from this session, and a report still in the undo window
    const place = served(await demoPlace("palac-krzysztofory"));
    const sent = { ...report("lift", "Nie ma"), key: "k-sent", reportId: "r-mine" };
    const queued = { ...report("bench", "Jest"), key: "k-queued", sending: true };

    // WHEN the card's pending entries are built
    const entries = pendingEntries(place, [sent, queued], "pl");

    // THEN the served reports come first with their value as text, the own one marked as such and not repeated
    expect(entries.map((e) => [e.key, e.attribute, e.mine, e.valueText])).toEqual([
      ["r-other", "lift", false, "Nie ma"],
      ["r-mine", "lift", true, "Nie ma"],
      ["k-queued", "bench", true, "Jest"],
    ]);
    expect(entries[0]).toMatchObject({ createdAt: "2026-10-02T08:00:00Z", sending: false });
    // AND an unmoderated comment is not passed on to the card
    expect(entries[0]).not.toHaveProperty("comment");
  });

  it("keeps a sent report the API doesn't list yet", async () => {
    // GIVEN a report the server accepted but the card's data predates (or the mock API never lists)
    const place = await demoPlace("palac-krzysztofory");
    const sent = { ...report("lift", "Nie ma"), reportId: "r-new" };

    // WHEN the card's pending entries are built
    // THEN the visitor still sees their report
    expect(pendingEntries(place, [sent], "pl")).toEqual([sent]);
  });

  it("drops a sent report once the API stops listing it, because a moderator has decided", async () => {
    // GIVEN a report the API listed before and no longer lists (rejected, or accepted and now a fact)
    const place = await demoPlace("palac-krzysztofory");
    const decided = { ...report("lift", "Nie ma"), reportId: "r-decided", served: true };

    // WHEN the card's pending entries are built
    // THEN it is no longer shown as pending
    expect(pendingEntries(place, [decided], "pl")).toEqual([]);
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
    // GIVEN a yes/no attribute and the surface attribute
    const ramp = reportInput("ramp", "pl");
    const surface = reportInput("surface", "pl");

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
    const rows = factViews(place, "pl");

    // THEN the known fact can be confirmed by id, the conflicting and unknown ones cannot
    expect(rows.find((r) => r.attribute === "step_count")?.confirmFactId).toBe("fact_osm_krzysztofory_steps");
    expect(rows.find((r) => r.attribute === "toilet_accessible")?.confirmFactId).toBeUndefined();
    expect(rows.find((r) => r.attribute === "lift")?.confirmFactId).toBeUndefined();
    // AND the edit link points at the OSM object, built from the OSM source's URL
    expect(osmEditUrl(place)).toBe("https://www.openstreetmap.org/edit?node=123456");
  });
});
