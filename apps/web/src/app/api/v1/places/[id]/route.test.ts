import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Place } from "@krakow-bez-barier/contracts";
import { validateResponse } from "@/server/http";
import { decideReport } from "@/server/reports";
import { createMemoryReportsStore } from "@/server/reports/memory-store";
import {
  createFakePlaceRepository,
  factRecord,
  placeRecord,
  sourceRecord,
} from "@/server/places/fake-repository";

const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });
const num = (number: number, unit: "cm" | "count" = "cm") => ({ kind: "number" as const, number, unit });

const city = sourceRecord({ id: "msip", name: "MSIP", kind: "official_open_data", baseReliability: "confirmed" });
const ziwDown = sourceRecord({
  id: "ziw",
  name: "ZIW",
  kind: "official_open_data",
  baseReliability: "confirmed",
  refreshStatus: "outage",
  statusNote: "Źródło niedostępne",
});

const palac = placeRecord({ name: "Pałac Krzysztofory", website: "https://muzeumkrakowa.pl", phone: "+48 12 619 23 00" });
const teatr = placeRecord({ name: "Teatr", website: "not a url" });
const hotel = placeRecord({ name: "Hotel Dostępny", category: "hotel" });
const parking = placeRecord({ name: "Miejsce postojowe: Sebastiana 7", category: "parking" });
const hostel = placeRecord({ name: "Hostel z windą", category: "hotel" });

const facts = [
  factRecord(palac, "toilet_accessible", bool(true)),
  factRecord(palac, "toilet_accessible", bool(false), { source: city, reliability: "confirmed" }),
  factRecord(palac, "lift", bool(true), { source: city, reliability: "confirmed", confirmations: 2, evidence: { comment: "winda od podwórza" } }),
  factRecord(teatr, "step_count", num(0, "count"), { source: ziwDown, reliability: "confirmed" }),
  factRecord(hotel, "step_count", num(0, "count"), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "threshold_cm", num(1), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "door_width_cm", num(95), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "lift", bool(true)),
  factRecord(hotel, "toilet_accessible", bool(true), { source: city, reliability: "confirmed" }),
  factRecord(hostel, "step_count", num(0, "count"), { source: city, reliability: "confirmed" }),
  factRecord(hostel, "threshold_cm", num(1), { source: city, reliability: "confirmed" }),
  factRecord(hostel, "door_width_cm", num(95), { source: city, reliability: "confirmed" }),
  factRecord(hostel, "lift", bool(true), { source: city, reliability: "confirmed" }),
  factRecord(hostel, "toilet_accessible", bool(true), { source: city, reliability: "confirmed" }),
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const outages = [
  {
    id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    placeId: hostel.id,
    equipment: "lift" as const,
    reportedAt: minutesAgo(20),
    confirmations: 1,
    lastConfirmedAt: minutesAgo(5),
    workingVotes: 0,
  },
  {
    id: "8d2e3f4a-5b6c-4d7e-9f8a-0b1c2d3e4f5a",
    placeId: hostel.id,
    equipment: "ramp" as const,
    reportedAt: minutesAgo(30),
    confirmations: 0,
    lastConfirmedAt: minutesAgo(30),
    workingVotes: 1,
  },
];

const repository = createFakePlaceRepository([palac, teatr, hotel, parking, hostel], facts, outages);

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => repository,
}));

let reports = createMemoryReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => reports.store,
}));

const { GET } = await import("./route");

async function get(id: string, params = "") {
  const res = await GET(new Request(`http://localhost/api/v1/places/${id}${params}`), {
    params: Promise.resolve({ id }),
  });
  const body = await res.json();
  expect(validateResponse("getPlace", res.status, body)).toEqual([]);
  return { status: res.status, body };
}

const attribute = (place: Place, name: string) => place.attributes.find((a) => a.attribute === name);

beforeEach(() => {
  reports = createMemoryReportsStore({ places: [{ id: palac.id, name: palac.name }] });
});

const report = (attribute: "lift" | "toilet_accessible", boolean: boolean, comment: string | null = null) =>
  reports.store.insertReport({ placeId: palac.id, attribute, value: bool(boolean), comment });

describe("GET /api/v1/places/{id}", () => {
  it("returns every attribute of the vocabulary, with both values of a conflict and their sources", async () => {
    // GIVEN OSM says the palace toilet is accessible and the city says it is not
    // WHEN the place is read
    const { status, body } = await get(palac.id);

    // THEN all 17 attributes are listed, the toilet is a conflict with both facts, the rest is explicit "no data"
    expect(status).toBe(200);
    expect(body.attributes).toHaveLength(17);
    const toilet = attribute(body, "toilet_accessible");
    expect(toilet).toMatchObject({ state: "conflict", status: "conflict", value: null });
    expect(toilet?.facts.map((f) => f.source.id).sort()).toEqual(["msip", "osm"]);
    expect(attribute(body, "ramp")).toMatchObject({ state: "unknown", status: "no_data", facts: [] });
    expect(body.sources.map((s: { id: string }) => s.id).sort()).toEqual(["msip", "osm"]);
    expect(body.contact).toEqual({ phone: "+48 12 619 23 00", website: "https://muzeumkrakowa.pl", email: null });
  });

  it("carries provenance and confirmations on every fact", async () => {
    // GIVEN a lift fact from the city confirmed twice by users
    // WHEN the place is read
    const { body } = await get(palac.id);

    // THEN the fact names its source, record, fetch date, reliability and confirmation count
    const [lift] = attribute(body, "lift")?.facts ?? [];
    expect(lift).toMatchObject({
      source: { id: "msip", name: "MSIP", kind: "official_open_data", recordRef: "node/1" },
      fetchedAt: "2026-10-01T00:00:00.000Z",
      reliability: "confirmed",
      evidence: { comment: "winda od podwórza", confirmations: 2, photoUrl: null },
      stale: false,
    });
  });

  it("keeps facts of a source in outage but marks them stale", async () => {
    // GIVEN the theatre's only fact comes from a source whose last refresh failed
    // WHEN the place is read
    const { body } = await get(teatr.id);

    // THEN the value is still there, outdated, and the source reports the outage; a non-URL website is dropped
    expect(attribute(body, "step_count")).toMatchObject({ state: "stale", status: "outdated", value: { number: 0 } });
    expect(attribute(body, "step_count")?.facts[0].stale).toBe(true);
    expect(body.sources).toEqual([expect.objectContaining({ id: "ziw", refreshStatus: "outage" })]);
    expect(body.contact).toBeNull();
  });

  it("adds a verdict whose needs split into blocks, fits and unknowns", async () => {
    // GIVEN the hotel meets every wheelchair need, but its lift is only known from OSM
    // WHEN read with the wheelchair profile and with a stricter threshold set by the user
    const preset = await get(hotel.id, "?profile=wheelchair");
    const strict = await get(hotel.id, "?profile=wheelchair&maxThresholdCm=0");
    const none = await get(hotel.id);

    // THEN the preset is met but unconfirmed, the strict threshold blocks, no profile means no verdict
    expect(preset.body.verdict).toMatchObject({ state: "met", unconfirmed: true });
    expect(preset.body.verdict.needs.find((n: { need: string }) => n.need === "lift")).toMatchObject({ state: "met", unconfirmed: true });
    expect(strict.body.verdict).toMatchObject({ state: "barrier", blockers: ["threshold_cm"], reasons: ["próg 1 cm"] });
    expect(none.body.verdict).toBeNull();
  });

  it("lists an active outage on the card and counts it in the verdict as an unconfirmed barrier", async () => {
    // GIVEN a hostel that meets the wheelchair profile on facts, with its lift reported broken (once confirmed) and
    // a ramp outage someone already marked as working
    // WHEN the card is read with the wheelchair profile
    const { body } = await get(hostel.id, "?profile=wheelchair");

    // THEN only the lift outage is listed, unverified, and it blocks the lift need without changing the lift fact
    expect(body.outages).toEqual([
      expect.objectContaining({ equipment: "lift", state: "reported", confirmations: 1, workingVotes: 0 }),
    ]);
    expect(attribute(body, "lift")).toMatchObject({ state: "known", value: bool(true) });
    expect(body.verdict).toMatchObject({ state: "barrier", unconfirmed: true, blockers: ["lift"], reasons: ["zgłoszona awaria windy"] });
    expect(body.verdict.needs.find((n: { need: string }) => n.need === "lift")).toMatchObject({ outage: true, unconfirmed: true });
  });

  it("answers 404 with a Problem for an unknown id", async () => {
    // GIVEN an id that is not in the database
    // WHEN it is read
    const { status, body } = await get("nie-ma-takiego");

    // THEN it is a 404 problem
    expect(status).toBe(404);
    expect(body).toMatchObject({ status: 404, detail: 'Place "nie-ma-takiego" does not exist.' });
  });

  it("still returns a place whose category is hidden from the default list", async () => {
    // GIVEN a parking space, a category that GET /places leaves out by default
    // WHEN it is read by id
    const { status, body } = await get(parking.id);

    // THEN it resolves like any other place
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: parking.id, category: "parking" });
  });

  it("lists reports awaiting moderation beside the value as unverified, without changing it", async () => {
    // GIVEN two visitors say the palace has no lift (one asked for details) and one says the toilet is accessible
    const first = await report("lift", false, "winda wyłączona");
    const second = await report("lift", false);
    await decideReport(reports.store, { reportId: second.id, decision: "needs_info", note: "zdjęcie?" }, { name: "anna", demo: false });
    await report("toilet_accessible", true);

    // WHEN the place is read
    const { body } = await get(palac.id);

    // THEN both lift reports sit beside the confirmed lift, which still says yes, without the unmoderated comment;
    // attributes without reports list none
    const lift = attribute(body, "lift");
    expect(lift).toMatchObject({ state: "known", status: "confirmed", value: { boolean: true } });
    expect(lift?.pendingReports).toEqual([
      { id: first.id, value: bool(false), comment: null, status: "new", createdAt: first.createdAt.toISOString() },
      expect.objectContaining({ id: second.id, status: "needs_info" }),
    ]);
    expect(attribute(body, "toilet_accessible")).toMatchObject({ state: "conflict", pendingReports: [expect.objectContaining({ value: bool(true) })] });
    expect(attribute(body, "ramp")?.pendingReports).toEqual([]);
  });

  it("still serves the place card when the reports can't be read", async () => {
    // GIVEN the reports table fails
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    reports.store.listPending = () => Promise.reject(new Error("relation does not exist"));

    // WHEN the place is read
    const { status, body } = await get(palac.id);

    // THEN the resolved facts come back without pending reports and the failure is logged
    expect(status).toBe(200);
    expect(attribute(body, "lift")).toMatchObject({ state: "known", value: { boolean: true } });
    expect(attribute(body, "lift")?.pendingReports).toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("drops a report once a moderator rejects or accepts it", async () => {
    // GIVEN two pending lift reports
    const rejected = await report("lift", false);
    const accepted = await report("lift", false);

    // WHEN a moderator rejects one and accepts the other, then the place is read
    await decideReport(reports.store, { reportId: rejected.id, decision: "rejected" }, { name: "anna", demo: false });
    await decideReport(reports.store, { reportId: accepted.id, decision: "accepted" }, { name: "anna", demo: false });
    const { body } = await get(palac.id);

    // THEN neither is listed as pending any more (the accepted one became a moderated fact in the store)
    expect(attribute(body, "lift")?.pendingReports).toEqual([]);
    expect(reports.facts.map((f) => f.source.name)).toEqual(["Społeczność, zweryfikowane przez moderatora"]);
  });
});
