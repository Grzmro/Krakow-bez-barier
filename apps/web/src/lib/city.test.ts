import { describe, expect, it } from "vitest";
import type { PriorityItem } from "@krakow-bez-barier/contracts";
import { messagesFor } from "@/i18n/messages";
import { priorityCsv, reasonsText } from "./city";

const item: PriorityItem = {
  rank: 1,
  placeId: "abc",
  placeName: '=Bar "Pod Arkadami"; Kraków',
  category: "restaurant",
  location: { type: "Point", coordinates: [19.94, 50.06] },
  score: 8,
  action: "fix",
  barriers: ["entrance", "toilet"],
  openReports: 0,
  reasons: [{ factor: "barrier", count: 2, points: 8 }],
};

describe("city panel text", () => {
  it("lists each reason with its points and the needs behind a barrier", () => {
    // GIVEN a place with barriers at the entrance and the toilet
    // WHEN its reasons are written out in Polish
    const text = reasonsText(item, messagesFor("pl"));

    // THEN both needs are named and the points shown
    expect(text).toBe("bariera: wejście, toaleta dostosowana (+8)");
  });

  it("exports the ranking as semicolon CSV that Excel opens safely", () => {
    // GIVEN a place whose free-text name starts like a formula and holds quotes and a semicolon
    // WHEN the ranking is exported
    const csv = priorityCsv([item], messagesFor("pl"), () => "Restauracja");

    // THEN it has a BOM and a header, the name is defused and quoted, and lines end with CRLF
    expect(csv.startsWith("﻿Nr;Miejsce;Kategoria;")).toBe(true);
    const [, row] = csv.slice(1).split("\r\n");
    expect(row).toBe(`1;"'=Bar ""Pod Arkadami""; Kraków";Restauracja;8;Naprawa;bariera: wejście, toaleta dostosowana (+8);0;19.94;50.06;abc`);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
