import { describe, expect, it } from "vitest";
import { type HomeCommitted, NO_CHOICES } from "./home-start";
import { committedToSearch, searchToCommitted } from "./home-url";

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

  it("never carries a position", () => {
    // GIVEN results around a position
    const nearby = { position: { latitude: 50.06, longitude: 19.94 } };
    // WHEN written
    // THEN the position is not in the URL
    expect(committedToSearch({ ...NO_CHOICES, q: "", category: "toilet", nearby })).toBe("?category=toilet");
  });

  it("drops unknown feature names and a stray unknown flag", () => {
    // GIVEN a hand-edited URL
    // WHEN read
    // THEN only known features stay, and 'unknown' needs one
    expect(searchToCommitted("?features=lift,evil&unknown=1").features).toEqual(["lift"]);
    expect(searchToCommitted("?category=toilet&unknown=1").showUnknown).toBe(false);
  });
});
