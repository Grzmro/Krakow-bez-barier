import { describe, expect, it } from "vitest";
import { validateResponse } from "@/server/http";
import { catalogs } from "@/i18n/messages";
import { listSources, simulatedOutageIds, toSource } from "./sources";

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

    // THEN only that source is in outage, with the note and the original last success
    expect(items[0].refreshStatus).toBe("ok");
    expect(items[1]).toMatchObject({
      refreshStatus: "outage",
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
