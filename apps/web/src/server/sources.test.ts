import { describe, expect, it } from "vitest";
import { validateResponse } from "@/server/http";
import { catalogs } from "@/i18n/messages";
import { isWithheld, listSources, localizeSourceText, simulatedOutageIds, toSource, withheldSourceIds } from "./sources";

type Row = Parameters<typeof toSource>[0];
const now = new Date("2026-10-03T12:00:00Z");
const row = (over: Partial<Row> = {}): Row => ({
  id: "osm",
  name: "OpenStreetMap",
  kind: "community",
  license: "ODbL 1.0",
  termsUrl: null,
  attribution: "© OpenStreetMap contributors",
  url: "https://www.openstreetmap.org",
  refreshInterval: "daily",
  baseReliability: "community",
  refreshStatus: "ok",
  lastSuccessAt: new Date("2026-10-03T03:00:00Z"),
  lastAttemptAt: new Date("2026-10-03T03:00:00Z"),
  statusNote: null,
  isSample: false,
  ...over,
});

describe("listSources", () => {
  it("maps rows to the spec's Source shape", async () => {
    // GIVEN a healthy source and one that never ran
    const rows = [
      row(),
      row({ id: "new", name: "New", refreshStatus: "never", lastSuccessAt: null, lastAttemptAt: null }),
    ];

    // WHEN listing
    const items = await listSources(async () => rows, now, []);

    // THEN the body is spec-valid and the DB-only columns do not leak
    expect(validateResponse("listSources", 200, { items })).toEqual([]);
    expect(items[0]).toMatchObject({ refreshStatus: "ok", lastSuccessAt: "2026-10-03T03:00:00.000Z" });
    expect(items[1]).toMatchObject({ refreshStatus: "never", lastSuccessAt: null });
    expect(items[0]).not.toHaveProperty("baseReliability");
  });

  it("reports a failed source as outage and keeps its last success date", async () => {
    // GIVEN a source whose last run failed
    const failed = row({
      refreshStatus: "outage",
      lastSuccessAt: new Date("2023-11-08T03:00:00Z"),
      statusNote: "HTTP 404",
    });

    // WHEN listing
    const [item] = await listSources(async () => [failed], now, []);

    // THEN the card can say "dane z <date>"
    expect(item).toMatchObject({
      refreshStatus: "outage",
      lastSuccessAt: "2023-11-08T03:00:00.000Z",
      statusNote: "HTTP 404",
    });
  });

  it("marks a source stale after two missed intervals", async () => {
    // GIVEN a daily source last refreshed three days ago, and one refreshed yesterday
    const old = row({ lastSuccessAt: new Date("2026-09-30T12:00:00Z") });
    const recent = row({ id: "r", lastSuccessAt: new Date("2026-10-02T12:00:00Z") });

    // WHEN listing
    const items = await listSources(async () => [old, recent], now, []);

    // THEN only the overdue one is stale
    expect(items.map((i) => i.refreshStatus)).toEqual(["stale", "ok"]);
  });

  it("overlays a simulated outage on the named source only, keeping its data date", async () => {
    // GIVEN two healthy sources and the switch set for one
    const rows = [row(), row({ id: "msip-toilets", name: "MSIP" })];

    // WHEN listing
    const items = await listSources(async () => rows, now, ["msip-toilets"]);

    // THEN only that source is in outage, labelled as simulated, with the note and the original last success
    expect(items[0]).toMatchObject({ refreshStatus: "ok", simulatedOutage: false });
    expect(items[1]).toMatchObject({
      refreshStatus: "outage",
      simulatedOutage: true,
      statusNote: catalogs.pl.pages.aboutData.statusNote.simulatedOutage,
      lastSuccessAt: "2026-10-03T03:00:00.000Z",
    });
    expect(validateResponse("listSources", 200, { items })).toEqual([]);
  });

  it("writes its own notes in the requested language", async () => {
    // GIVEN an overdue source and a simulated outage
    const rows = [row({ lastSuccessAt: new Date("2026-09-30T12:00:00Z") }), row({ id: "msip-toilets", name: "MSIP" })];

    // WHEN listing for an English UI
    const items = await listSources(async () => rows, now, ["msip-toilets"], "en");

    // THEN both notes are English
    expect(items.map((i) => i.statusNote)).toEqual([
      "The source didn't refresh on time. The data may be outdated.",
      "Simulated source outage (test switch). We show the last known data as outdated.",
    ]);
  });
});

describe("localizeSourceText", () => {
  const pl = catalogs.pl.pages.aboutData;
  const en = catalogs.en.pages.aboutData;

  it("replaces the internal licence and seed wording with Polish copy", async () => {
    // GIVEN a seeded source whose licence is still being confirmed, and a source never fetched for that reason
    const rows = [
      row({
        id: "msip-toilets",
        kind: "official_open_data",
        license: "To be confirmed (KBB-20)",
        refreshInterval: "unknown",
        statusNote: "Seeded from a one-off query, not an ingestion run",
      }),
      row({
        id: "msip-koh",
        kind: "official_open_data",
        license: "To be confirmed",
        refreshInterval: "unknown",
        refreshStatus: "never",
        lastSuccessAt: null,
        lastAttemptAt: null,
      }),
    ];

    // WHEN listing
    const items = await listSources(async () => rows, now, []);

    // THEN no raw English or task id reaches the reader, the withheld MSIP layer and the never-fetched source say why
    expect(items[0]).toMatchObject({ license: pl.licenseNote.pending, statusNote: pl.statusNote.withheldBySource["msip-toilets"] });
    expect(items[1]).toMatchObject({ license: pl.licenseNote.pending, statusNote: pl.statusNote.awaitingLicense });
    expect(JSON.stringify(items)).not.toMatch(/KBB-|To be confirmed|Seeded from/);
  });

  it("describes user reports instead of their internal licence and keeps real licences", () => {
    // GIVEN a user-report source and a never-fetched source with a known licence
    const reports = { id: "community-moderated", kind: "user_report", license: "Not open data: user reports", refreshStatus: "ok", statusNote: null } as const;
    const osm = { id: "osm", kind: "community", license: "ODbL 1.0", refreshStatus: "never", statusNote: null } as const;

    // WHEN localizing for English
    const [r, o] = [localizeSourceText(reports, "en"), localizeSourceText(osm, "en")];

    // THEN the report licence is described, ODbL stays and the new source is plainly "not fetched yet"
    expect(r.license).toBe(en.licenseNote.userReports);
    expect(o).toMatchObject({ license: "ODbL 1.0", statusNote: en.statusNote.notFetched });
  });

  it("says a source switched off by config is not shown, whatever its own note", () => {
    // GIVEN a licensed source that the operator switched off, with its own status note
    const source = { id: "krakow-pl-toilets", kind: "official_open_data", license: "krakow.pl", refreshStatus: "ok", statusNote: "x" } as const;

    // WHEN localizing with that source withheld, and without
    const off = localizeSourceText(source, "pl", ["krakow-pl-toilets"]);
    const on = localizeSourceText(source, "pl", []);

    // THEN only the withheld one says its data is not shown
    expect(off.statusNote).toBe(pl.statusNote.withheld);
    expect(on.statusNote).toBe("x");
  });
});

describe("isWithheld", () => {
  it("withholds a source whose licence is still to be confirmed, or one listed in WITHHELD_SOURCES", () => {
    // GIVEN the MSIP layer (licence pending), OSM, and a config switch for krakow.pl
    const withheld = withheldSourceIds({ WITHHELD_SOURCES: " krakow-pl-toilets, ," });

    // WHEN checking each source
    // THEN facts of MSIP and of the switched-off source are not served, OSM's are
    expect(withheld).toEqual(["krakow-pl-toilets"]);
    expect(isWithheld({ id: "msip-toilets", license: "To be confirmed (KBB-20)" }, [])).toBe(true);
    expect(isWithheld({ id: "krakow-pl-toilets", license: "krakow.pl" }, withheld)).toBe(true);
    expect(isWithheld({ id: "osm", license: "ODbL 1.0" }, withheld)).toBe(false);
    expect(withheldSourceIds({})).toEqual([]);
  });
});

describe("simulatedOutageIds", () => {
  it("parses a comma separated list and ignores blanks", () => {
    // GIVEN the env var with spaces and an empty entry
    // WHEN parsing THEN ids are trimmed
    expect(simulatedOutageIds({ SIMULATE_SOURCE_OUTAGE: " a, b ,," })).toEqual(["a", "b"]);
    expect(simulatedOutageIds({ SIMULATE_SOURCE_OUTAGE: "a", NODE_ENV: "production" })).toEqual([]);
    expect(
      simulatedOutageIds({ SIMULATE_SOURCE_OUTAGE: "a", NODE_ENV: "production", ALLOW_SIMULATED_OUTAGE: "true" }),
    ).toEqual(["a"]);
    expect(simulatedOutageIds({})).toEqual([]);
  });
});
