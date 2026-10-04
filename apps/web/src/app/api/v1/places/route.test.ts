import { describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import {
  createFakePlaceRepository,
  factRecord,
  placeRecord,
  sourceRecord,
} from "@/server/places/fake-repository";
import type { PlaceRepository } from "@/server/places/repository";

const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });
const num = (number: number, unit: "cm" | "count" = "cm") => ({ kind: "number" as const, number, unit });

const city = sourceRecord({ id: "msip", name: "MSIP", kind: "official_open_data", baseReliability: "confirmed" });

const palac = placeRecord({ name: "Pałac Krzysztofory", street: "Rynek Główny", houseNumber: "35", location: { x: 19.9381, y: 50.0623 } });
const kawiarnia = placeRecord({ name: "Kawiarnia Przykład", category: "restaurant", street: "Floriańska", location: { x: 19.9445, y: 50.0612 } });
const muzeum = placeRecord({ name: "Muzeum bez windy", location: { x: 19.9, y: 50.03 } });
const hotel = placeRecord({ name: "Hotel Dostępny", category: "hotel", location: { x: 19.94, y: 50.06 } });
const parking = placeRecord({ name: "Miejsce postojowe: Sebastiana 7", category: "parking", location: { x: 19.94, y: 50.05 } });
const stop = placeRecord({ name: "Przystanek Wawrzyńca 01", category: "transit_stop", location: { x: 19.95, y: 50.05 } });

const world = {
  places: [palac, kawiarnia, muzeum, hotel, parking, stop],
  facts: [
    factRecord(palac, "lift", bool(true), { source: city, reliability: "confirmed" }),
    factRecord(palac, "toilet_accessible", bool(true)),
    factRecord(palac, "toilet_accessible", bool(false), { source: city, reliability: "confirmed" }),
    factRecord(muzeum, "lift", bool(false)),
    factRecord(hotel, "step_count", num(0, "count"), { source: city, reliability: "confirmed" }),
    factRecord(hotel, "threshold_cm", num(1), { source: city, reliability: "confirmed" }),
    factRecord(hotel, "door_width_cm", num(95), { source: city, reliability: "confirmed" }),
    factRecord(hotel, "lift", bool(true), { source: city, reliability: "confirmed" }),
    factRecord(hotel, "toilet_accessible", bool(true), { source: city, reliability: "confirmed" }),
  ],
};

const repository: { current: PlaceRepository } = {
  current: createFakePlaceRepository(world.places, world.facts),
};

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => repository.current,
}));

const { GET } = await import("./route");

async function list(params: string, headers: HeadersInit = {}) {
  const res = await GET(new Request(`http://localhost/api/v1/places${params}`, { headers }));
  const body = await res.json();
  expect(validateResponse("listPlaces", res.status, body)).toEqual([]);
  return { status: res.status, body };
}

const names = (body: { items: { name: string }[] }) => body.items.map((p) => p.name);

describe("GET /api/v1/places", () => {
  it("lists every place sorted by name, without verdicts when no profile is set", async () => {
    // GIVEN four places
    // WHEN listing without parameters
    const { status, body } = await list("");

    // THEN all come back in name order with explicit "brak danych" chips and no verdict
    expect(status).toBe(200);
    expect(names(body)).toEqual(["Hotel Dostępny", "Kawiarnia Przykład", "Muzeum bez windy", "Pałac Krzysztofory"]);
    expect(body.total).toBe(4);
    expect(body.items.every((p: { verdict: unknown }) => p.verdict === null)).toBe(true);
    const cafe = body.items.find((p: { name: string }) => p.name === "Kawiarnia Przykład");
    expect(cafe.summary).toEqual([
      { attribute: "step_count", state: "unknown", status: "no_data", label: "Wejście: brak danych" },
      { attribute: "toilet_accessible", state: "unknown", status: "no_data", label: "Toaleta dostosowana: brak danych" },
    ]);
  });

  it("labels chips and gives verdict reasons in the language chosen in the app", async () => {
    // GIVEN the language cookie set to English
    const english = { cookie: "kbb-lang=en" };
    // WHEN listing with the wheelchair profile
    const { body } = await list("?profile=wheelchair", english);

    // THEN the chips and reasons are English, while place names stay as they are
    const museum = body.items.find((p: { name: string }) => p.name === "Muzeum bez windy");
    expect(museum.summary).toContainEqual({ attribute: "step_count", state: "unknown", status: "no_data", label: "Entrance: no data" });
    expect(museum.verdict.reasons).toContain("entrance");
  });

  it("finds a place by name or address, ignoring Polish letters and case", async () => {
    // GIVEN "Pałac Krzysztofory" at "Rynek Główny" and a café on "Floriańska"
    // WHEN searching without diacritics
    const byName = await list("?q=palac");
    const byStreet = await list("?q=FLORIANSKA");

    // THEN each finds its place only
    expect(names(byName.body)).toEqual(["Pałac Krzysztofory"]);
    expect(names(byStreet.body)).toEqual(["Kawiarnia Przykład"]);
  });

  it("filters by category and bbox", async () => {
    // GIVEN places in and out of a small Old Town box
    // WHEN filtering by bbox, then by category
    const inBox = await list("?bbox=19.93,50.05,19.95,50.07");
    const hotels = await list("?category=hotel,restaurant");

    // THEN the distant museum is left out, and only the requested categories come back
    expect(names(inBox.body)).not.toContain("Muzeum bez windy");
    expect(inBox.body.total).toBe(3);
    expect(names(hotels.body)).toEqual(["Hotel Dostępny", "Kawiarnia Przykład"]);
  });

  it("hides places without data for a feature by default and marks them with includeUnknown", async () => {
    // GIVEN a lift in the palace and the hotel, no lift in the museum, no data for the café
    // WHEN filtering by lift, without and with includeUnknown
    const strict = await list("?feature=lift");
    const withUnknown = await list("?feature=lift&includeUnknown=true");

    // THEN only known lifts pass by default; with includeUnknown the café is added, marked "brak danych",
    // and the museum with a known missing lift never comes back
    expect(names(strict.body)).toEqual(["Hotel Dostępny", "Pałac Krzysztofory"]);
    expect(names(withUnknown.body)).toEqual(["Hotel Dostępny", "Kawiarnia Przykład", "Pałac Krzysztofory"]);
    const cafe = withUnknown.body.items.find((p: { name: string }) => p.name === "Kawiarnia Przykład");
    expect(cafe.summary).toContainEqual({ attribute: "lift", state: "unknown", status: "no_data", label: "Winda: brak danych" });
    expect(cafe.features).toEqual([{ feature: "lift", state: "unknown" }]);
    expect(withUnknown.body.items[0].features).toEqual([{ feature: "lift", state: "met" }]);
  });

  it("returns an accessible toilet known only from outdated data as stale and dated, only with includeUnknown", async () => {
    // GIVEN a public toilet whose accessible toilet comes from a page dated 15.09.2025 (over 12 months ago)
    const sukiennice = placeRecord({ name: "Toaleta publiczna Sukiennice", category: "toilet", location: { x: 19.9373, y: 50.0617 } });
    const previous = repository.current;
    repository.current = createFakePlaceRepository(
      [sukiennice],
      [factRecord(sukiennice, "toilet_accessible", bool(true), { source: city, observedAt: new Date("2025-09-15T00:00:00Z") })],
    );

    try {
      // WHEN filtering by toilet_accessible, without and with includeUnknown
      const strict = await list("?feature=toilet_accessible");
      const withUnknown = await list("?feature=toilet_accessible&includeUnknown=true");

      // THEN outdated data is never a pass by default, and with includeUnknown it comes back stale with its date
      expect(names(strict.body)).toEqual([]);
      expect(withUnknown.body.items[0].features).toEqual([
        { feature: "toilet_accessible", state: "stale", asOf: "2025-09-15T00:00:00.000Z" },
      ]);
    } finally {
      repository.current = previous;
    }
  });

  it("marks steps with unknown ramp data as unknown for step_free, never as step-free", async () => {
    // GIVEN a place with two steps and no ramp data, and one with steps and a known ramp
    const steps = placeRecord({ name: "Schody bez danych o podjeździe", location: { x: 19.94, y: 50.06 } });
    const ramp = placeRecord({ name: "Schody z podjazdem", location: { x: 19.94, y: 50.06 } });
    const previous = repository.current;
    repository.current = createFakePlaceRepository(
      [steps, ramp],
      [
        factRecord(steps, "step_count", num(2, "count"), { source: city, reliability: "confirmed" }),
        factRecord(ramp, "step_count", num(2, "count"), { source: city, reliability: "confirmed" }),
        factRecord(ramp, "ramp", bool(true), { source: city, reliability: "confirmed" }),
      ],
    );

    try {
      // WHEN filtering by step_free, without and with includeUnknown
      const strict = await list("?feature=step_free");
      const withUnknown = await list("?feature=step_free&includeUnknown=true");

      // THEN only the ramp passes by default; with includeUnknown the steps place is marked unknown
      // and its summary says the ramp has no data
      expect(names(strict.body)).toEqual(["Schody z podjazdem"]);
      const place = withUnknown.body.items.find((p: { name: string }) => p.name === steps.name);
      expect(place.features).toEqual([{ feature: "step_free", state: "unknown" }]);
      expect(place.summary).toContainEqual({ attribute: "ramp", state: "unknown", status: "no_data", label: "Podjazd: brak danych" });
    } finally {
      repository.current = previous;
    }
  });

  it("adds a verdict with per-need groups for a profile and honours the user's thresholds", async () => {
    // GIVEN the hotel meets every wheelchair need on confirmed data, with a 95 cm door
    // WHEN listing with the wheelchair profile, then with a stricter door width
    const preset = await list("?q=hotel&profile=wheelchair");
    const strict = await list("?q=hotel&profile=wheelchair&minDoorWidthCm=100");

    // THEN the preset is met and confirmed, the stricter threshold blocks on the door
    expect(preset.body.items[0].verdict).toMatchObject({ state: "met", unconfirmed: false });
    expect(preset.body.items[0].verdict.needs.map((n: { need: string }) => n.need)).toEqual([
      "entrance",
      "door",
      "lift",
      "toilet",
    ]);
    expect(strict.body.items[0].verdict).toMatchObject({ state: "barrier", blockers: ["door_width_cm"], reasons: ["drzwi 95 cm"] });
  });

  it("counts a reported lift outage in the list verdict, and the place is met again once it works", async () => {
    // GIVEN the hotel, which meets the wheelchair profile, with its lift reported broken 10 minutes ago
    const outage = {
      id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      placeId: hotel.id,
      equipment: "lift" as const,
      reportedAt: new Date(Date.now() - 10 * 60_000),
      confirmations: 0,
      lastConfirmedAt: new Date(Date.now() - 10 * 60_000),
      workingVotes: 0,
    };
    const previous = repository.current;
    try {
      repository.current = createFakePlaceRepository(world.places, world.facts, [outage]);
      // WHEN listing with the wheelchair profile
      const broken = await list("?q=hotel&profile=wheelchair");
      // THEN the lift blocks, marked unconfirmed
      expect(broken.body.items[0].verdict).toMatchObject({ state: "barrier", unconfirmed: true, reasons: ["zgłoszona awaria windy"] });

      // WHEN someone has marked it as working
      repository.current = createFakePlaceRepository(world.places, world.facts, [{ ...outage, workingVotes: 1 }]);
      const fixed = await list("?q=hotel&profile=wheelchair");
      // THEN the hotel meets the profile again
      expect(fixed.body.items[0].verdict).toMatchObject({ state: "met", unconfirmed: false });
    } finally {
      repository.current = previous;
    }
  });

  it("shows the demo outage switch in the list's chips and verdicts, as on the place card", async () => {
    // GIVEN the hotel meets every wheelchair need on city data only, and the operator simulates the city source's outage
    vi.stubEnv("SIMULATE_SOURCE_OUTAGE", "msip");
    try {
      // WHEN listing with the wheelchair profile
      const { body } = await list("?q=hotel&profile=wheelchair");

      // THEN the hotel's city facts are outdated in the chips, and the verdict that is met on fresh data
      // turns unknown instead of vouching for them
      const [item] = body.items;
      expect(item.summary).toContainEqual(expect.objectContaining({ attribute: "step_count", state: "stale", status: "outdated" }));
      // AND the chip says the value and that it is outdated in words, not by colour
      const steps = item.summary.find((chip: { attribute: string }) => chip.attribute === "step_count");
      expect(steps.label).toMatch(/^Wejście: .+ · nieaktualne$/);
      expect(item.verdict.state).toBe("unknown");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("checks a facility need the profile switches on through its query parameter", async () => {
    // GIVEN the wheelchair profile, which doesn't ask for a bench by default
    // WHEN listing with requireBench=true
    const { status, body } = await list("?q=hotel&profile=wheelchair&requireBench=true");

    // THEN the request is valid and the bench is one of the verdict's needs
    expect(status).toBe(200);
    expect(body.items[0].verdict.needs.map((n: { need: string }) => n.need)).toEqual(["entrance", "door", "lift", "toilet", "bench"]);
  });

  it("judges the senior profile by its preset: a bench and a lift instead of a toilet", async () => {
    // GIVEN the hotel has a step-free entrance and a lift on confirmed data, but no bench data
    // WHEN listing with the senior profile, then without its bench need
    const preset = await list("?q=hotel&profile=senior");
    const noBench = await list("?q=hotel&profile=senior&requireBench=false");

    // THEN the bench is a need the hotel can't answer, and dropping it leaves a confirmed match
    expect(preset.body.items[0].verdict).toMatchObject({ state: "unknown", unknowns: ["bench"], reasons: ["ławka"] });
    expect(preset.body.items[0].verdict.needs.map((n: { need: string }) => n.need)).toEqual(["entrance", "door", "lift", "bench"]);
    expect(noBench.body.items[0].verdict).toMatchObject({ state: "met", unconfirmed: false });
  });

  it("never gives the conflicting or the empty place a met verdict", async () => {
    // GIVEN the palace's toilet data conflicts and the café has none
    // WHEN listing with either profile
    for (const profile of ["wheelchair", "stroller"]) {
      const { body } = await list(`?profile=${profile}`);
      const verdictOf = (name: string) => body.items.find((p: { name: string }) => p.name === name).verdict.state;
      // THEN neither is met
      expect(verdictOf("Pałac Krzysztofory")).toBe("conflict");
      expect(verdictOf("Kawiarnia Przykład")).toBe("unknown");
    }
  });

  it("pages with an opaque cursor", async () => {
    // GIVEN four places
    // WHEN reading two pages of two
    const first = await list("?limit=2");
    const second = await list(`?limit=2&cursor=${first.body.nextCursor}`);

    // THEN the pages don't overlap, the total stays the full count and the last page has no cursor
    expect(names(first.body)).toEqual(["Hotel Dostępny", "Kawiarnia Przykład"]);
    expect(names(second.body)).toEqual(["Muzeum bez windy", "Pałac Krzysztofory"]);
    expect(second.body.total).toBe(4);
    expect(second.body.nextCursor).toBeNull();
  });

  it("orders by distance with near and pages with a cursor tied to that point", async () => {
    // GIVEN four places, the hotel being nearest to the point
    // WHEN reading two pages of two near it
    const first = await list("?near=19.94,50.06&limit=2");
    const second = await list(`?near=19.94,50.06&limit=2&cursor=${first.body.nextCursor}`);

    // THEN the nearest come first without overlap
    const all = names(first.body).concat(names(second.body));
    expect(all[0]).toBe("Hotel Dostępny");
    expect(new Set(all).size).toBe(4);
    expect(second.body.nextCursor).toBeNull();
  });

  it("answers 400 for a name cursor with near, a near cursor without it and a bad point", async () => {
    // GIVEN cursors of both orders
    const byName = (await list("?limit=1")).body.nextCursor;
    const byNear = (await list("?near=19.94,50.06&limit=1")).body.nextCursor;

    // WHEN they are mixed up
    const responses = await Promise.all([
      list(`?near=19.94,50.06&cursor=${byName}`),
      list(`?cursor=${byNear}`),
      list("?near=19.94,120"),
      list("?near=19.94"),
    ]);

    // THEN each is a 400 problem
    for (const { status } of responses) expect(status).toBe(400);
    expect(responses[0].body.errors[0].field).toBe("query.cursor");
    expect(responses[2].body.errors[0].field).toBe("query.near");
  });

  it("answers 400 with a Problem for an inverted bbox, a forged cursor or an unknown category", async () => {
    // GIVEN requests the spec or the semantics reject
    // WHEN listing
    const responses = await Promise.all([
      list("?bbox=19.95,50.05,19.93,50.07"),
      list("?cursor=not-a-cursor"),
      list("?category=castle"),
    ]);

    // THEN each is a 400 problem naming the field
    for (const { status } of responses) expect(status).toBe(400);
    expect(responses[0].body.errors).toEqual([{ field: "query.bbox", message: expect.any(String) }]);
    expect(responses[1].body.errors[0].field).toBe("query.cursor");
  });

  it("accepts a category that is in the configuration but not in any enum", async () => {
    // GIVEN the configured pharmacy category (one entry in packages/contracts/src/categories.ts)
    // WHEN listing with it
    const { status } = await list("?category=pharmacy");

    // THEN the query is valid
    expect(status).toBe(200);
  });

  it("leaves parking spaces and stops out of the default list, unless their category is named", async () => {
    // GIVEN a parking space and a transit stop next to the ordinary places
    // WHEN listing without and with a category
    const names = async (params: string) => (await list(params)).body.items.map((p: { name: string }) => p.name);
    const all = await names("");
    const onlyParking = await names("?category=parking");
    const both = await names("?category=parking,transit_stop");

    // THEN the default list has neither, and naming the category brings them back
    expect(all).toHaveLength(4);
    expect(all).not.toContain(parking.name);
    expect(all).not.toContain(stop.name);
    expect(onlyParking).toEqual([parking.name]);
    expect(both.sort()).toEqual([parking.name, stop.name].sort());
    expect(await names("?q=Sebastiana")).toEqual([]);
    expect(await names("?q=Sebastiana&category=parking")).toEqual([parking.name]);
  });

  it("does not call a stop's entrance or toilet unknown in its list row", async () => {
    // GIVEN a stop with no facts: it has a platform, not an entrance or a toilet
    // WHEN listing stops
    const { body } = await list("?category=transit_stop");

    // THEN its row carries no "brak danych" chips for venue attributes
    expect(body.items.map((p: { name: string; summary: unknown[] }) => [p.name, p.summary])).toEqual([[stop.name, []]]);
  });

  it("lists benches and disabled parking bays for their feature filter, but never mapped steps", async () => {
    // GIVEN an OSM bench, a disabled parking bay and a flight of steps next to a café with a bench
    const osm = sourceRecord();
    const bench = placeRecord({ name: "Ławka", category: "bench", location: { x: 19.94, y: 50.06 } });
    const bay = placeRecord({ name: "Miejsce postojowe dla osób z niepełnosprawnościami", category: "parking", location: { x: 19.94, y: 50.05 } });
    const steps = placeRecord({ name: "Schody", category: "steps", location: { x: 19.94, y: 50.06 } });
    const cafe = placeRecord({ name: "Kawiarnia z ławką", category: "restaurant", location: { x: 19.94, y: 50.06 } });
    const saved = repository.current;
    repository.current = createFakePlaceRepository(
      [bench, bay, steps, cafe],
      [
        factRecord(bench, "bench", bool(true), { source: osm }),
        factRecord(cafe, "bench", bool(true), { source: osm }),
        factRecord(bay, "disabled_parking", bool(true), { source: osm }),
        factRecord(steps, "step_count", num(12, "count"), { source: osm }),
      ],
    );
    try {
      // WHEN listing without a filter, with the bench filter and with the parking filter
      const all = names((await list("")).body);
      const benches = names((await list("?feature=bench")).body);
      const parkingBays = names((await list("?feature=disabled_parking")).body);

      // THEN benches and bays show up only for their own filter, next to the places that have the feature
      expect(all).toEqual([cafe.name]);
      expect(benches.sort()).toEqual([cafe.name, bench.name].sort());
      expect(parkingBays).toEqual([bay.name]);
      // AND the steps stay out, even with places of unknown benches included
      expect(names((await list("?feature=bench&includeUnknown=true")).body)).not.toContain(steps.name);
    } finally {
      repository.current = saved;
    }
  });
});
