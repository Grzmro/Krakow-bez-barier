import { describe, expect, it } from "vitest";
import { relativeTime } from "./outages";

const NOW = new Date("2026-10-03T12:00:00Z");
const shift = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

describe("relativeTime", () => {
  it("says how long ago an outage was reported and when it expires, in the card's language", () => {
    // GIVEN times around now
    // WHEN formatting them in Polish and English
    // THEN the largest readable unit is used
    expect(relativeTime(shift(0), NOW, "pl")).toBe("teraz");
    expect(relativeTime(shift(-20), NOW, "pl")).toBe("20 min temu");
    expect(relativeTime(shift(47 * 60), NOW, "pl")).toBe("za 47 godz.");
    expect(relativeTime(shift(-20), NOW, "en")).toBe("20 min ago");
    expect(relativeTime(shift(3 * 24 * 60), NOW, "en")).toBe("in 3 days");
  });
});
