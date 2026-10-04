import { describe, expect, it } from "vitest";
import { factRecord, placeRecord } from "./fake-repository";
import { toFact } from "./service";

const NOW = new Date("2026-10-04T12:00:00Z");

describe("toFact", () => {
  it("names the entrance a fact describes, from the stored subject", () => {
    // GIVEN a door width stored from an OSM main entrance node
    const place = placeRecord({ name: "Amber" });
    const record = factRecord(place, "door_width_cm", { kind: "number", number: 153, unit: "cm" }, {
      subject: "entrance:main",
      sourceRecordRef: "osm:node/3090820032@v2",
    });
    // WHEN mapping it to the API shape
    const fact = toFact(record, NOW);
    // THEN it carries the entrance and the entrance's own record
    expect(fact).toMatchObject({ entrance: "main", source: { recordRef: "osm:node/3090820032@v2" } });
  });

  it("leaves a fact about the whole place without an entrance", () => {
    // GIVEN a fact about the place WHEN mapping it THEN there is no entrance field
    const place = placeRecord({ name: "Amber" });
    expect(toFact(factRecord(place, "lift", { kind: "boolean", boolean: true }), NOW)).not.toHaveProperty("entrance");
  });
});
