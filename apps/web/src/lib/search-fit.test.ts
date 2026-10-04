import { describe, expect, it } from "vitest";
import { FIT_TOP, searchFitTargets } from "./search-fit";

const at = (id: string, lon: number, lat: number) => ({ id, location: { coordinates: [lon, lat] } });

describe("searchFitTargets", () => {
  it("fits the best matches and leaves out a far-off namesake", () => {
    // GIVEN ranked results for "Wawel": four at Wawel and one across town
    const ranked = [
      at("zamek", 19.9366, 50.0544),
      at("kosci", 19.935, 50.0546),
      at("bistro-wawelska", 20.0002, 50.0985),
      at("wawel-zaginiony", 19.9363, 50.0541),
    ];

    // WHEN choosing what the map fits
    const ids = searchFitTargets(ranked).map((p) => p.id);

    // THEN only the places near the best match count
    expect(ids).toEqual(["zamek", "kosci", "wawel-zaginiony"]);
  });

  it("looks only at the first few results", () => {
    // GIVEN more results than the fit considers, all close together
    const ranked = Array.from({ length: FIT_TOP + 3 }, (_, i) => at(`p${i}`, 19.94 + i * 0.0001, 50.06));

    // WHEN choosing what the map fits
    // THEN at most FIT_TOP of them decide
    expect(searchFitTargets(ranked)).toHaveLength(FIT_TOP);
  });

  it("fits nothing when nothing was found", () => {
    // GIVEN no results
    // WHEN choosing what the map fits
    // THEN there is nothing to fit
    expect(searchFitTargets([])).toEqual([]);
  });
});
