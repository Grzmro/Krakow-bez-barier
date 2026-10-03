import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mocks/mock-fetch";
import { eventPath, eventSections, formatEventDate, isEventDate, readEventDetails } from "./event-page";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: withPlacesMocks(createMockFetch()) });

async function examplePlace(id: string) {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example place ${id}`);
  return data;
}

describe("eventPath / readEventDetails", () => {
  it("round-trips the event name and date through the link", () => {
    // GIVEN an organizer's event at a place
    const details = { name: "Koncert jesienny & goście", date: "2026-10-10" };

    // WHEN the link is built and read back by the event page
    const path = eventPath("teatr-slowackiego", details);
    const url = new URL(path, "http://localhost");
    const read = readEventDetails(Object.fromEntries(url.searchParams));

    // THEN the path names the place and the page gets the same name and date
    expect(url.pathname).toBe("/wydarzenie/teatr-slowackiego");
    expect(read).toEqual(details);
  });

  it("leaves out empty and malformed values instead of showing them", () => {
    // GIVEN a link without a name and with an impossible date
    // WHEN it's built and read
    const path = eventPath("sukiennice", { name: "   ", date: "2026-02-30" });
    const read = readEventDetails({ nazwa: "  ", data: "jutro" });

    // THEN neither ends up in the link or on the page
    expect(path).toBe("/wydarzenie/sukiennice");
    expect(read).toEqual({});
  });

  it("caps an over-long name and takes the first of repeated parameters", () => {
    // GIVEN a hand-edited link with a very long name repeated twice
    const long = "x".repeat(500);

    // WHEN it's read
    const read = readEventDetails({ nazwa: [long, "drugi"], data: ["2026-10-10", "2026-10-11"] });

    // THEN the name is capped and the first values win
    expect(read.name).toHaveLength(120);
    expect(read.date).toBe("2026-10-10");
  });
});

describe("isEventDate / formatEventDate", () => {
  it("accepts only real calendar days and formats them in Polish without a time zone shift", () => {
    // GIVEN dates from a date input and from a hand-edited link
    // WHEN they're validated and formatted
    // THEN only real days pass and the formatted day is the one picked
    expect(isEventDate("2026-10-10")).toBe(true);
    expect(isEventDate("2026-13-01")).toBe(false);
    expect(isEventDate("10.10.2026")).toBe(false);
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
