import { describe, expect, it } from "vitest";
import type { ModerationReport } from "@krakow-bez-barier/contracts";
import { changePreview, isOpen, moderationHistory, retryMinutes } from "./moderation";

const report = (over: Partial<ModerationReport> = {}): ModerationReport => ({
  id: "r1",
  placeId: "p1",
  placeName: "Podziemia Rynku",
  attribute: "door_width_cm",
  value: { kind: "number", number: 85, unit: "cm" },
  currentValue: null,
  comment: null,
  photoUrl: null,
  status: "new",
  createdAt: "2026-10-03T09:00:00Z",
  decidedAt: null,
  history: [],
  ...over,
});

describe("changePreview", () => {
  it("shows a missing current value as Brak danych, not as a value", () => {
    // GIVEN a report for an attribute the card knows nothing about
    // WHEN previewing the change
    const preview = changePreview(report(), "pl");

    // THEN the card goes from "Brak danych" to the reported width
    expect(preview).toEqual({
      attribute: "Szerokość drzwi",
      before: "Brak danych",
      beforeSource: null,
      after: "85 cm",
      beforeKnown: false,
    });
  });

  it("formats the current and the reported value of a yes/no attribute", () => {
    // GIVEN a report that the lift no longer works
    const lift = report({
      attribute: "lift",
      value: { kind: "boolean", boolean: false },
      currentValue: { kind: "boolean", boolean: true },
    });

    // WHEN previewing the change
    const preview = changePreview(lift, "pl");

    // THEN both values read as words
    expect(preview.before).toBe("Jest");
    expect(preview.after).toBe("Nie ma");
    expect(preview.beforeKnown).toBe(true);
  });
});

describe("isOpen", () => {
  it.each([
    ["new", true],
    ["needs_info", true],
    ["accepted", false],
    ["rejected", false],
  ] as const)("treats %s as open: %s", (status, open) => {
    // GIVEN / WHEN / THEN only reports without a final decision stay in the queue
    expect(isOpen({ status })).toBe(open);
  });
});

describe("moderationHistory", () => {
  it("lists every decision across reports with who and when, newest first", () => {
    // GIVEN two reports, one asked about and then accepted
    const reports = [
      report({
        id: "a",
        status: "accepted",
        history: [
          { decision: "needs_info", note: "Które wejście?", moderator: "anna", decidedAt: "2026-10-03T10:00:00Z" },
          { decision: "accepted", note: null, moderator: "jan", decidedAt: "2026-10-03T12:00:00Z" },
        ],
      }),
      report({
        id: "b",
        placeName: "Sukiennice",
        status: "rejected",
        history: [{ decision: "rejected", note: null, moderator: "anna", decidedAt: "2026-10-03T11:00:00Z" }],
      }),
    ];

    // WHEN building the history
    const history = moderationHistory(reports, "pl");

    // THEN decisions are ordered by time and carry the place, attribute and value
    expect(history.map((h) => [h.reportId, h.decision, h.moderator])).toEqual([
      ["a", "accepted", "jan"],
      ["b", "rejected", "anna"],
      ["a", "needs_info", "anna"],
    ]);
    expect(history[0].summary).toBe("Podziemia Rynku · Szerokość drzwi → 85 cm");
    expect(history[1].summary).toBe("Sukiennice · Szerokość drzwi · zgłoszono: 85 cm");
    expect(new Set(history.map((h) => h.key)).size).toBe(3);
  });
});

describe("retryMinutes", () => {
  it.each([
    ["900", 15],
    ["61", 2],
    ["1", 1],
    [null, 15],
    ["soon", 15],
  ])("turns Retry-After %s into %i min", (header, minutes) => {
    // GIVEN / WHEN / THEN seconds round up to whole minutes; a missing header means the full lockout
    expect(retryMinutes(header)).toBe(minutes);
  });
});
