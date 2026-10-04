import { describe, expect, it } from "vitest";
import { type HomeCommitted, NO_CHOICES } from "./home-start";
import { committedToSearch, searchToCommitted, searchWantsNear } from "./home-url";

describe("home URL", () => {
  it("round-trips a committed query", () => {
    // GIVEN results for text, a category and features
    const committed: HomeCommitted = { ...NO_CHOICES, q: "kawa & ciasto", category: "restaurant", features: ["lift", "bench"], showUnknown: true };
    // WHEN written to a URL and read back
    // THEN the same query returns
    expect(searchToCommitted(committedToSearch(committed))).toEqual(committed);
  });

  it("is empty at the start", () => {
    // GIVEN nothing was asked
    // THEN the URL has no search part, and an empty one reads as the start
    expect(committedToSearch({ ...NO_CHOICES, q: "" })).toBe("");
    expect(searchToCommitted("")).toEqual({ ...NO_CHOICES, q: "" });
  });

  it("never carries a position, only that the results are around the device", () => {
    // GIVEN results around the device's position
    const nearby = { position: { latitude: 50.06, longitude: 19.94 } };
    // WHEN written
    const search = committedToSearch({ ...NO_CHOICES, q: "", category: "toilet", nearby });
    // THEN the coordinates are not in the URL, a flag is
    expect(search).toBe("?category=toilet&near=1");
    expect(searchWantsNear(search)).toBe(true);
  });

  it("does not keep a point the user chose by name", () => {
    // GIVEN results around a chosen place
    const nearby = { place: "Rynek", position: { latitude: 50.06, longitude: 19.94 } };
    // WHEN written
    // THEN nothing about it is in the URL
    expect(committedToSearch({ ...NO_CHOICES, q: "", category: "toilet", nearby })).toBe("?category=toilet");
  });

  it("reads a near-only URL as the start until the position arrives", () => {
    // GIVEN a URL that only says "around me"
    // WHEN read
    // THEN the query is the start state, and the flag is available separately
    expect(searchToCommitted("?near=1")).toEqual({ ...NO_CHOICES, q: "" });
    expect(searchWantsNear("?near=1")).toBe(true);
    expect(searchWantsNear("?category=toilet")).toBe(false);
  });

  it("drops unknown feature names and a stray unknown flag", () => {
    // GIVEN a hand-edited URL
    // WHEN read
    // THEN only known features stay, and 'unknown' needs one
    expect(searchToCommitted("?features=lift,evil&unknown=1").features).toEqual(["lift"]);
    expect(searchToCommitted("?category=toilet&unknown=1").showUnknown).toBe(false);
  });
});
