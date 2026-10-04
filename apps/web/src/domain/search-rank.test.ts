import { describe, expect, it } from "vitest";
import { searchRank } from "./search-rank";

describe("searchRank", () => {
  it("puts the exact name first, then landmarks, whole words, word starts and the rest", () => {
    // GIVEN folded names of places that all contain "wawel"
    // WHEN they are ranked for the query "wawel"
    const rank = (name: string, category: string) => searchRank(name, category, "wawel");

    // THEN an exact name beats a landmark, which beats a hotel named with the whole word, then a word start, then a match inside a word
    expect(rank("wawel", "hotel")).toBe(0);
    expect(rank("zamek krolewski na wawelu", "other")).toBe(1);
    expect(rank("kosci „smoka wawelskiego”", "other")).toBe(1);
    expect(rank("hotel wawel", "hotel")).toBe(2);
    expect(rank("pod wawelem", "restaurant")).toBe(3);
    expect(rank("podwawelska", "pharmacy")).toBe(4);
  });

  it("needs every query word for a better rank", () => {
    // GIVEN a two-word query
    // WHEN a name has only one of the words
    // THEN it falls to the last rank, while a name with both ranks by how they match
    expect(searchRank("hotel wawel", "hotel", "hotel queen")).toBe(4);
    expect(searchRank("hotel wawel queen", "hotel", "hotel queen")).toBe(2);
    expect(searchRank("muzeum narodowe", "museum", "muz nar")).toBe(1);
  });

  it("ranks every place the same for a single letter, which names nothing", () => {
    // GIVEN "r", the start of one name and inside many addresses
    // WHEN ranking
    // THEN no place goes first, so the plain order (distance or name) stays
    expect(searchRank("restauracja przyklad", "restaurant", "r")).toBe(0);
    expect(searchRank("sukiennice", "museum", "r")).toBe(0);
  });

  it("ranks every place the same without a query", () => {
    // GIVEN an empty query
    // WHEN ranking
    // THEN nothing is preferred
    expect(searchRank("hotel wawel", "hotel", "")).toBe(0);
  });
});
