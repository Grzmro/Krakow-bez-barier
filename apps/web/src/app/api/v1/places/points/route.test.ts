import { describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { createFakePlaceRepository, factRecord, placeRecord, sourceRecord } from "@/server/places/fake-repository";
import type { PlaceRepository } from "@/server/places/repository";
import { listPlacePoints, MAX_MAP_POINTS } from "@/server/places/service";

const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });
const num = (number: number, unit: "cm" | "count" = "cm") => ({ kind: "number" as const, number, unit });

const city = sourceRecord({ id: "msip", name: "MSIP", kind: "official_open_data", baseReliability: "confirmed" });

const hotel = placeRecord({ name: "Hotel Dostępny", category: "hotel", location: { x: 19.94, y: 50.06 } });
const kawiarnia = placeRecord({ name: "Kawiarnia Przykład", category: "restaurant", location: { x: 19.9445123456789, y: 50.0612 } });
const muzeum = placeRecord({ name: "Muzeum bez windy", location: { x: 19.9, y: 50.03 } });
const nowaHuta = placeRecord({ name: "Teatr Ludowy", category: "theatre", location: { x: 20.0347, y: 50.0717 } });
const parking = placeRecord({ name: "Miejsce postojowe: Sebastiana 7", category: "parking", location: { x: 19.94, y: 50.05 } });

const places = [hotel, kawiarnia, muzeum, nowaHuta, parking];
const facts = [
  factRecord(hotel, "step_count", num(0, "count"), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "threshold_cm", num(1), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "door_width_cm", num(95), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "lift", bool(true), { source: city, reliability: "confirmed" }),
  factRecord(hotel, "toilet_accessible", bool(true), { source: city, reliability: "confirmed" }),
  factRecord(muzeum, "step_count", num(4, "count"), { source: city, reliability: "confirmed" }),
  factRecord(muzeum, "ramp", bool(false), { source: city, reliability: "confirmed" }),
  factRecord(muzeum, "door_width_cm", num(60), { source: city, reliability: "confirmed" }),
  factRecord(parking, "disabled_parking", bool(true), { source: city, reliability: "confirmed" }),
];

const repository: { current: PlaceRepository } = { current: createFakePlaceRepository(places, facts) };

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => repository.current,
}));

const { GET } = await import("./route");

const KRAKOW = "19.79,49.97,20.22,50.13";

async function points(params: string) {
  const res = await GET(new Request(`http://localhost/api/v1/places/points${params}`));
  const body = await res.json();
  expect(validateResponse("listPlacePoints", res.status, body)).toEqual([]);
  return { status: res.status, body };
}

const ids = (body: { items: { id: string }[] }) => body.items.map((p) => p.id).toSorted();

describe("GET /api/v1/places/points", () => {
  it("returns every place in the bbox as a light point, without verdicts when no profile is set", async () => {
    // GIVEN places across the city
    // WHEN the whole city's points are asked for
    const { status, body } = await points(`?bbox=${KRAKOW}`);

    // THEN each place the list would show is a point with id, name, category, a rounded location and no verdict
    expect(status).toBe(200);
    expect(ids(body)).toEqual([hotel, kawiarnia, muzeum, nowaHuta].map((p) => p.id).toSorted());
    expect(body).toMatchObject({ total: 4, truncated: false });
    expect(body.items.find((p: { id: string }) => p.id === kawiarnia.id)).toEqual({
      id: kawiarnia.id,
      name: "Kawiarnia Przykład",
      category: "restaurant",
      location: { type: "Point", coordinates: [19.944512, 50.0612] },
      verdict: null,
    });
  });

  it("keeps only the places inside the bbox", async () => {
    // GIVEN / WHEN only the Old Town is in view
    const { body } = await points("?bbox=19.92,50.05,19.95,50.07");

    // THEN Nowa Huta and the museum in Podgórze are left out
    expect(ids(body)).toEqual([hotel.id, kawiarnia.id].toSorted());
  });

  it("gives the profile verdict's state, and no data is unknown, never met", async () => {
    // GIVEN / WHEN the wheelchair profile is on
    const { body } = await points(`?bbox=${KRAKOW}&profile=wheelchair`);

    // THEN the hotel meets it, the museum with steps doesn't, and the café without data is unknown
    const verdict = (id: string) => body.items.find((p: { id: string }) => p.id === id).verdict;
    expect(verdict(hotel.id)).toBe("met");
    expect(verdict(muzeum.id)).toBe("barrier");
    expect(verdict(kawiarnia.id)).toBe("unknown");
  });

  it("honours the visitor's thresholds and counts a reported outage, like the list", async () => {
    // GIVEN the hotel, which meets the wheelchair presets with a 95 cm door
    const verdictOf = async (params: string) =>
      (await points(`?bbox=${KRAKOW}&q=hotel&profile=wheelchair${params}`)).body.items[0].verdict;

    // WHEN a stricter door width is asked for
    // THEN the hotel's door blocks it
    expect(await verdictOf("&minDoorWidthCm=100")).toBe("barrier");

    // WHEN its lift was reported broken 10 minutes ago
    const previous = repository.current;
    try {
      repository.current = createFakePlaceRepository(places, facts, [
        {
          id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
          placeId: hotel.id,
          equipment: "lift",
          reportedAt: new Date(Date.now() - 10 * 60_000),
          confirmations: 0,
          lastConfirmedAt: new Date(Date.now() - 10 * 60_000),
          workingVotes: 0,
        },
      ]);
      // THEN its point is a barrier too, not met
      expect(await verdictOf("")).toBe("barrier");
    } finally {
      repository.current = previous;
    }
  });

  it("shows categories hidden by default only with the feature filter that asks for them", async () => {
    // GIVEN a disabled parking space, hidden by default
    // WHEN the disabled-parking filter is on
    const { body } = await points(`?bbox=${KRAKOW}&feature=disabled_parking`);

    // THEN the parking space is there, and nothing without known disabled parking is
    expect(ids(body)).toEqual([parking.id]);
  });

  it("applies feature filters like the list, including places without data on request", async () => {
    // GIVEN / WHEN the step-free filter, first strict and then with places we can't say about
    const strict = await points(`?bbox=${KRAKOW}&feature=step_free`);
    const withUnknown = await points(`?bbox=${KRAKOW}&feature=step_free&includeUnknown=true`);

    // THEN only the hotel is known to be step-free; the museum with steps never passes
    expect(ids(strict.body)).toEqual([hotel.id]);
    expect(ids(withUnknown.body)).toEqual([hotel.id, kawiarnia.id, nowaHuta.id].toSorted());
  });

  it("filters by text and category like the list", async () => {
    // GIVEN / WHEN searching for a theatre by name
    const { body } = await points(`?bbox=${KRAKOW}&q=ludowy&category=theatre`);

    // THEN only that theatre comes back
    expect(ids(body)).toEqual([nowaHuta.id]);
  });

  it("refuses a request without a bbox or with an inverted one", async () => {
    // GIVEN / WHEN the bbox is missing, then inverted
    const missing = await points("");
    const inverted = await points("?bbox=20.2,50.1,19.8,49.9");

    // THEN both are 400 problems naming the bbox
    expect(missing.status).toBe(400);
    expect(inverted.status).toBe(400);
    expect(inverted.body.errors).toEqual([{ field: "query.bbox", message: expect.any(String) }]);
  });
});

describe("listPlacePoints", () => {
  it("stops at the safety limit and says the answer was cut", async () => {
    // GIVEN more places than the limit allows
    const many = Array.from({ length: MAX_MAP_POINTS + 3 }, (_, i) =>
      placeRecord({ name: `Miejsce ${i}`, location: { x: 19.9 + (i % 100) * 0.001, y: 50.0 + Math.floor(i / 100) * 0.0001 } }),
    );

    // WHEN their points are listed
    const result = await listPlacePoints({ bbox: [19.79, 49.97, 20.22, 50.13] }, { repository: createFakePlaceRepository(many, []) });

    // THEN the answer holds exactly the limit, in a stable order, with the full total and the cut flagged
    expect(result.items).toHaveLength(MAX_MAP_POINTS);
    expect(result.total).toBe(MAX_MAP_POINTS + 3);
    expect(result.truncated).toBe(true);
    expect(result.items[0].id).toBe(many.map((p) => p.id).toSorted()[0]);
  });
});
