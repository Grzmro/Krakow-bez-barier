import { describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import {
  createFakePlaceRepository,
  factRecord,
  placeRecord,
  sourceRecord,
} from "@/server/places/fake-repository";

const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });
const city = sourceRecord({ id: "msip", name: "MSIP", kind: "official_open_data", baseReliability: "confirmed" });

const hotel = placeRecord({ name: "Hotel Dostępny", category: "hotel" });
const lobby = placeRecord({ name: "Hotel z windą", category: "hotel" });
const empty = placeRecord({ name: "Pusta Kawiarnia", category: "restaurant" });

const repository = createFakePlaceRepository(
  [hotel, empty, lobby],
  [
    factRecord(lobby, "lift", bool(false), { source: city, reliability: "confirmed", observedAt: new Date("2023-01-01T00:00:00Z") }),
    factRecord(lobby, "lift", bool(true), { reliability: "community", observedAt: new Date() }),
    factRecord(hotel, "lift", bool(true), { source: city, reliability: "confirmed" }),
    factRecord(hotel, "toilet_accessible", bool(true)),
    factRecord(hotel, "toilet_accessible", bool(false), { source: city, reliability: "confirmed" }),
  ],
);

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => repository,
}));

const { GET } = await import("./route");

async function get(placeId: string, params = "") {
  const res = await GET(new Request(`http://localhost/api/v1/widget/${placeId}${params}`), {
    params: Promise.resolve({ placeId }),
  });
  const body = await res.json();
  expect(validateResponse("getWidgetCard", res.status, body)).toEqual([]);
  return { status: res.status, body };
}

const fact = (body: { facts: { attribute: string; sourceName: string | null }[] }, name: string) =>
  body.facts.find((f) => f.attribute === name);

describe("GET /api/v1/widget/{placeId}", () => {
  it("gives every fact its source, date and status, with the attribution of the sources used", async () => {
    // GIVEN a hotel with a confirmed lift fact and a conflicting toilet
    // WHEN the widget card is read
    const { status, body } = await get(hotel.id);

    // THEN the lift names its source and date, the conflict has no value, and the attribution is there
    expect(status).toBe(200);
    expect(fact(body, "lift")).toMatchObject({
      state: "known",
      status: "confirmed",
      reliability: "confirmed",
      sourceName: "MSIP",
      fetchedAt: expect.any(String),
    });
    expect(fact(body, "toilet_accessible")).toMatchObject({ state: "conflict", status: "conflict", value: null, sourceName: null });
    expect(body.attribution).toContain("Kraków bez barier");
    expect(body.attribution).toContain("OpenStreetMap");
  });

  it("credits the source and date of the fresh fact that gave the value, not a stale one", async () => {
    // GIVEN a stale confirmed "no lift" from MSIP and a fresh community "lift"
    // WHEN the card is read
    const { body } = await get(lobby.id);

    // THEN the value is the fresh one with the fresh fact's source, not MSIP's
    expect(fact(body, "lift")).toMatchObject({ state: "known", value: { kind: "boolean", boolean: true }, reliability: "community" });
    expect(fact(body, "lift")?.sourceName).not.toBe("MSIP");
  });

  it("shows missing data as no data, never as accessible", async () => {
    // GIVEN a place without any fact
    // WHEN the card is read
    const { body } = await get(empty.id);

    // THEN every attribute is unknown with no data and no source
    expect(body.facts.length).toBeGreaterThan(0);
    for (const f of body.facts) expect(f).toMatchObject({ state: "unknown", status: "no_data", value: null, sourceName: null, fetchedAt: null });
  });

  it("answers 404 with a Problem for an unknown place and 400 for an unknown profile", async () => {
    // GIVEN a missing id and a profile the spec doesn't know
    // WHEN reading them
    const missing = await GET(new Request("http://localhost/api/v1/widget/nope"), { params: Promise.resolve({ placeId: "nope" }) });
    const badProfile = await GET(new Request(`http://localhost/api/v1/widget/${hotel.id}?profile=giant`), {
      params: Promise.resolve({ placeId: hotel.id }),
    });

    // THEN 404 and 400, both problem documents
    expect(missing.status).toBe(404);
    expect(badProfile.status).toBe(400);
    expect(badProfile.headers.get("content-type")).toContain("application/problem+json");
  });
});
