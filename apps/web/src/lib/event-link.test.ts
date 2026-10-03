import { describe, expect, it } from "vitest";
import { eventPath, isEventDate, readEventDetails } from "./event-link";

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

describe("isEventDate", () => {
  it("accepts only real calendar days", () => {
    // GIVEN dates from a date input and from a hand-edited link
    // WHEN they're validated
    // THEN only real days pass
    expect(isEventDate("2026-10-10")).toBe(true);
    expect(isEventDate("2026-13-01")).toBe(false);
    expect(isEventDate("10.10.2026")).toBe(false);
  });
});
