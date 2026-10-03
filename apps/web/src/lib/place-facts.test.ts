import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type Place } from "@krakow-bez-barier/contracts";
import { bool, fact, text } from "@/domain/fixtures";
import { matchProfile } from "@/domain/matcher";
import { PROFILE_PRESETS } from "@/domain/profiles";
import { resolveAttributes } from "@/domain/resolver";
import { messagesFor } from "@/i18n/messages";
import { factViews, failedSources, formatValue, latestSourceDate, osmEditUrl, parseOsmRecordRef } from "./place-facts";

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
    expect(factViews(place, "pl").find((r) => r.attribute === "step_count")).toMatchObject({
      value: "Bez stopni",
      reliability: "confirmed",
    });
  });

  it("lists every card attribute as unknown for a place without data", async () => {
    // GIVEN the incomplete demo place
    const place = await demoPlace("kawiarnia-przyklad");

    // WHEN it is turned into card rows
    const rows = factViews(place, "pl");

    // THEN every row is an explicit "no data"
    expect(rows.length).toBe(13);
    expect(rows.every((r) => r.unknown && r.sources.length === 0)).toBe(true);
  });

  it("shows the OSM overall wheelchair tag when it is the place's only fact, in the list chip's words", () => {
    // GIVEN a place whose only fact is OSM wheelchair=no
    const osm = fact("wheelchair_overall", text("no"), {
      source: { id: "osm", name: "OpenStreetMap", kind: "community", recordRef: "node/1" },
      fetchedAt: "2026-10-02T10:00:00Z",
    });
    const attributes = resolveAttributes([osm]);
    const place = { attributes } as unknown as Place;

    // WHEN it is turned into card rows
    const rows = factViews(place, "pl");
    const overall = rows.find((r) => r.attribute === "wheelchair_overall");

    // THEN the overall row comes first, with the value, the OpenStreetMap source and its date
    expect(rows[0]).toBe(overall);
    expect(overall).toMatchObject({ label: "Ogólna dostępność", value: "Niedostępne dla wózków", unknown: false });
    expect(overall?.sources).toMatchObject([{ name: "OpenStreetMap", date: "2.10.2026" }]);
    // AND the list chip says the same thing
    expect(messagesFor("pl").summary.chip("wheelchair_overall", "known", osm.value)).toBe(overall?.value);
    // AND the wheelchair profile names it as the barrier
    expect(matchProfile(place, PROFILE_PRESETS.wheelchair, "pl")).toMatchObject({ state: "barrier", blockers: ["wheelchair_overall"] });
  });

  it("shows the quoted sentence, the source page and the source's own date of a fact read from a page", () => {
    // GIVEN a lift read from a BIP MK page updated on 19 March 2026
    const bip = fact("lift", bool(true), {
      source: { id: "bip-mk", name: "BIP Miasta Krakowa: dostępność architektoniczna", kind: "official_open_data", recordRef: "bip-mk:page/19180/zajezdnia@2026-03-19" },
      reliability: "extracted",
      fetchedAt: "2026-10-04T03:00:00Z",
      observedAt: "2026-03-19T00:00:00Z",
      evidence: { comment: "„Komunikację pomiędzy piętrami zapewnia winda.”", url: "https://www.bip.krakow.pl/?mmi=19180" },
    });
    const place = { attributes: resolveAttributes([bip], new Date("2026-10-04T12:00:00Z")) } as unknown as Place;

    // WHEN it is turned into card rows
    const [source] = factViews(place, "pl").find((r) => r.attribute === "lift")?.sources ?? [];

    // THEN the provenance names the quote, links the page and says when the source last stated it
    expect(source).toMatchObject({
      name: "BIP Miasta Krakowa: dostępność architektoniczna",
      date: "4.10.2026",
      detail: "odczytane automatycznie · stan na 19.03.2026 wg źródła",
      note: "„Komunikację pomiędzy piętrami zapewnia winda.”",
      link: { href: "https://www.bip.krakow.pl/?mmi=19180", label: "Strona źródła" },
    });
  });

  it("keeps a visitor's report comment off the card", () => {
    // GIVEN an accepted report whose fact carries the visitor's comment
    const report = fact("ramp", bool(true), {
      source: { id: "user-reports", name: "Zgłoszenia", kind: "user_report", recordRef: "report/1" },
      reliability: "user_report",
      evidence: { comment: "Byłam wczoraj, pochylnia jest", confirmations: 0 },
    });
    const place = { attributes: resolveAttributes([report]) } as unknown as Place;

    // WHEN it is turned into card rows
    const [source] = factViews(place, "pl").find((r) => r.attribute === "ramp")?.sources ?? [];

    // THEN the comment is not shown as the source's words
    expect(source?.note).toBeUndefined();
    expect(source?.link).toBeUndefined();
  });

  it("names the city's MSIP, not OSM, when MSIP is the only source of the overall tag", () => {
    // GIVEN a public toilet whose overall tag comes only from MSIP
    const msip = fact("wheelchair_overall", text("limited"), {
      sourceId: "msip-toilets",
      source: { id: "msip-toilets", name: "MSIP: Toalety publiczne", kind: "official_open_data", recordRef: "msip-toilets:toalety/1" },
    });
    const place = { attributes: resolveAttributes([msip]) } as unknown as Place;

    // WHEN it is turned into a card row and a list chip
    const overall = factViews(place, "pl").find((r) => r.attribute === "wheelchair_overall");
    const chip = messagesFor("pl").summary.chip("wheelchair_overall", "known", msip.value);

    // THEN neither the label nor the chip claims OpenStreetMap, and the row names MSIP as its source
    expect(overall?.label).not.toContain("OSM");
    expect(chip).not.toContain("OSM");
    expect(overall?.sources.map((s) => s.name)).toEqual(["MSIP: Toalety publiczne"]);
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

describe("OSM edit link", () => {
  it.each([
    ["osm:node/1", { type: "node", id: "1" }],
    ["osm:way/2@v3", { type: "way", id: "2" }],
    ["osm:node/1@geofabrik-2026-10-02", { type: "node", id: "1" }],
    ["osm:way/2;geofabrik-2026-10-02", { type: "way", id: "2" }],
    ["osm:relation/7@v21;geofabrik-2026-10-02", { type: "relation", id: "7" }],
    ["node/123456", { type: "node", id: "123456" }],
  ])("reads the OSM object from %s", (recordRef, expected) => {
    // GIVEN a stored recordRef
    // WHEN it is parsed
    // THEN only the element type and id are kept
    expect(parseOsmRecordRef(recordRef)).toEqual(expected);
  });

  it.each(["msip:toilet/12", "osm:node/abc", "osm:changeset/5", "node/1x"])("rejects %s", (recordRef) => {
    // GIVEN a recordRef that isn't an OSM element
    // WHEN it is parsed
    // THEN there is nothing to edit
    expect(parseOsmRecordRef(recordRef)).toBeUndefined();
  });

  it("links to the OSM object for a fact read from the Geofabrik extract", async () => {
    // GIVEN a place whose OSM fact carries the prefix, the version and the extract suffix, as ingest stores it
    const place = structuredClone(await demoPlace("palac-krzysztofory"));
    const osmFact = place.attributes.flatMap((a) => a.facts).find((f) => f.source.recordRef?.includes("node/"));
    if (!osmFact) throw new Error("demo place has no OSM fact");
    osmFact.source.recordRef = "osm:node/979972831@v21;geofabrik-2026-10-02";

    // WHEN building the edit link
    // THEN it points at that node on the OSM source's site
    expect(osmEditUrl(place)).toBe("https://www.openstreetmap.org/edit?node=979972831");
  });
});
