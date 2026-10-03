import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mocks/mock-fetch";
import { eventSections, formatEventDate } from "./event-page";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: withPlacesMocks(createMockFetch()) });

async function examplePlace(id: string) {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example place ${id}`);
  return data;
}

describe("formatEventDate", () => {
  it("formats the day in Polish without a time zone shift", () => {
    // GIVEN a date picked by the organizer
    // WHEN it's formatted
    // THEN the formatted day is the one picked
    expect(formatEventDate("2026-10-10")).toBe("sobota, 10 października 2026");
  });
});

describe("eventSections", () => {
  it("groups the entrance, toilet and parking facts and names missing data as missing", async () => {
    // GIVEN the demo hotel from the spec examples (no data on the changing table or parking)
    const place = await examplePlace("hotel-przyklad");

    // WHEN the event page groups its facts
    const sections = Object.fromEntries(eventSections(place).map((s) => [s.id, s.facts]));

    // THEN the entrance carries its known facts with sources and dates
    const door = sections.entrance.find((f) => f.attribute === "door_width_cm");
    expect(door).toMatchObject({ value: "90", unit: "cm", reliability: "confirmed", unknown: false });
    expect(door?.sources[0]).toMatchObject({ name: "Dane obiektu", date: "12.09.2026" });
    // AND the toilet and parking sections list unknowns as "brak danych", never as accessible
    expect(sections.toilet.map((f) => [f.attribute, f.unknown])).toEqual([
      ["toilet_accessible", false],
      ["changing_table", true],
    ]);
    expect(sections.parking).toEqual([expect.objectContaining({ attribute: "disabled_parking", unknown: true, reliability: "unknown" })]);
  });

  it("shows both sides of a conflict with their sources", async () => {
    // GIVEN a place where two sources disagree about the toilet
    const place = await examplePlace("palac-krzysztofory");

    // WHEN its facts are grouped
    const toilet = eventSections(place).find((s) => s.id === "toilet")?.facts[0];

    // THEN the row is a conflict and each source carries its own value
    expect(toilet).toMatchObject({ attribute: "toilet_accessible", reliability: "conflict", conflict: true });
    expect(toilet?.sources.map((s) => s.value)).toEqual(expect.arrayContaining(["Jest", "Nie ma"]));
  });
});
