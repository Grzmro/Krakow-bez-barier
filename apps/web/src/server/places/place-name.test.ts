import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePlaceRepository, placeRecord } from "./fake-repository";
import { findPlaceName } from "./place-name";

const qubus = placeRecord({ name: "Qubus" });
const repository = () => createFakePlaceRepository([qubus], []);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("findPlaceName", () => {
  it("names a place that exists, for the card's title", async () => {
    // GIVEN a place in the database
    // WHEN its card looks up the name
    const name = await findPlaceName(qubus.id, { mock: false, repository });

    // THEN the title can carry it
    expect(name).toBe("Qubus");
  });

  it("answers null for a place that doesn't exist, so the card returns 404", async () => {
    // GIVEN an id no place has
    // WHEN the card looks it up
    // THEN it is known to be missing
    expect(await findPlaceName("nie-istnieje", { mock: false, repository })).toBeNull();
  });

  it("can't tell without a database, so the card renders and reports its own state", async () => {
    // GIVEN no database
    // WHEN the card looks the place up
    // THEN the answer doesn't claim the place is missing
    expect(await findPlaceName(qubus.id, { mock: false, repository: () => null })).toBeUndefined();
  });

  it("can't tell when the database fails, so an existing card never turns into a 404", async () => {
    // GIVEN a database that throws, and one whose client can't even be created
    const broken = createFakePlaceRepository([], []);
    broken.findPlace = () => Promise.reject(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    // WHEN the card looks the place up
    // THEN neither answer claims the place is missing
    expect(await findPlaceName(qubus.id, { mock: false, repository: () => broken })).toBeUndefined();
    expect(
      await findPlaceName(qubus.id, {
        mock: false,
        repository: () => {
          throw new Error("invalid DATABASE_URL");
        },
      }),
    ).toBeUndefined();
  });

  it("looks places up in the spec's examples in the example-data mode", async () => {
    // GIVEN the example-data mode
    // WHEN an example place and an unknown id are looked up
    // THEN the example is named and the unknown one is missing
    expect(await findPlaceName("sukiennice", { mock: true })).toBe("Sukiennice");
    expect(await findPlaceName("nie-istnieje", { mock: true })).toBeNull();
  });
});
