import { describe, expect, it } from "vitest";
import type { AccessibilityFact, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { messagesFor } from "@/i18n/messages";
import { routeSpeech, segmentSpeech } from "./route-speech";

const pl = messagesFor("pl");

function surface(text: string): AccessibilityFact {
  return {
    id: `surface-${text}`,
    attribute: "surface",
    value: { kind: "text", text },
    source: { id: "osm", name: "OpenStreetMap", kind: "osm" },
    fetchedAt: "2026-10-03T10:00:00Z",
    reliability: "community",
  } as unknown as AccessibilityFact;
}

function segment(state: RouteSegment["state"], note: string | null, facts: AccessibilityFact[] = []): RouteSegment {
  return {
    id: 1,
    name: "Floriańska",
    instruction: "Skręć w prawo",
    lengthMeters: 257.4,
    state,
    note,
    facts,
    geometry: { type: "LineString", coordinates: [] },
  };
}

describe("segmentSpeech", () => {
  it("reads the step, its state and the surface with the metres in words", () => {
    // GIVEN a segment that meets the needs on paving slabs
    const step = segment("met", "płyty chodnikowe", [surface("paving_stones")]);

    // WHEN it is turned into speech
    const text = segmentSpeech(pl, step, 1, 33, "pl");

    // THEN it says the step number, the distance without the "m" symbol, the state and the surface
    expect(text).toBe("Krok 2 z 33. Skręć w prawo, 257 metrów. Spełnia: płyty chodnikowe. Nawierzchnia: płyty chodnikowe.");
  });

  it("says no data for a segment nobody has checked, never that it is accessible", () => {
    // GIVEN a segment without any facts
    const step = segment("unknown", null);

    // WHEN it is turned into speech
    const text = segmentSpeech(pl, step, 0, 2, "pl");

    // THEN it says "Brak danych" for the state and the surface, and that nobody has checked it
    expect(text).toBe("Krok 1 z 2. Skręć w prawo, 257 metrów. Brak danych. Nawierzchnia: brak danych. Nikt jeszcze nie sprawdził tego odcinka.");
    expect(text).not.toContain("Spełnia");
  });

  it("names the barrier and the missing part on a partly unknown segment", () => {
    // GIVEN a segment with stairs, and one with a surface fact but no kerb data
    const stairs = segment("barrier", "schody");
    const partly = segment("unknown", "brak danych o krawężnikach", [surface("asphalt")]);

    // WHEN they are turned into speech
    const barrier = segmentSpeech(pl, stairs, 0, 2, "pl");
    const unknown = segmentSpeech(pl, partly, 1, 2, "pl");

    // THEN the barrier is named and the partly unknown segment says what is missing
    expect(barrier).toContain("Nie spełnia: schody.");
    expect(barrier).toContain("Nawierzchnia: brak danych.");
    expect(unknown).toContain("Częściowo nie wiemy: brak danych o krawężnikach.");
    expect(unknown).toContain("Nawierzchnia: asfalt.");
  });

  it("speaks English with English words for the units", () => {
    // GIVEN the English catalog
    const en = messagesFor("en");

    // WHEN a one-metre segment without data is turned into speech
    const text = segmentSpeech(en, { ...segment("unknown", null), lengthMeters: 1 }, 0, 1, "en");

    // THEN the unit is a word and no data is said as such
    expect(text).toBe("Step 1 of 1. Skręć w prawo, 1 metre. No data. Surface: no data. Nobody has checked this segment yet.");
  });
});

describe("routeSpeech", () => {
  it("gives one utterance per segment in order", () => {
    // GIVEN a route of two segments
    const route = { segments: [segment("met", null, [surface("asphalt")]), segment("barrier", "schody")] } as unknown as Route;

    // WHEN it is turned into speech
    const texts = routeSpeech(pl, route, "pl");

    // THEN each segment is its own text, numbered of the total
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatch(/^Krok 1 z 2\./);
    expect(texts[1]).toMatch(/^Krok 2 z 2\..*Nie spełnia: schody\./);
  });
});
