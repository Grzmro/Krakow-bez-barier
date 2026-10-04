import { describe, expect, it } from "vitest";
import type { AccessibilityFact, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { messagesFor } from "@/i18n/messages";
import { announcementSpeech, distanceSpeech, guidanceSpeech, routeSpeech, segmentSpeech, spokenUnits } from "./route-speech";

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

describe("spokenUnits", () => {
  it("says units in words and drops symbols a voice would spell out", () => {
    // GIVEN display notes with centimetres, percent and separators
    const t = pl.route.speech;

    // WHEN / THEN
    expect(spokenUnits(t, "krawężnik 4 cm")).toBe("krawężnik 4 centymetry");
    expect(spokenUnits(t, "krawężnik 2,5 cm")).toBe("krawężnik 2,5 centymetra");
    expect(spokenUnits(t, "krawężnik 5 cm")).toBe("krawężnik 5 centymetrów");
    expect(spokenUnits(t, "nachylenie do 8%")).toBe("nachylenie do 8 procent");
    expect(spokenUnits(t, "Floriańska · schody")).toBe("Floriańska, schody");
  });
});

describe("distanceSpeech", () => {
  it("rounds for the ear and says the unit in words", () => {
    // GIVEN / WHEN / THEN
    const t = pl.route.speech;
    expect(distanceSpeech(t, 47)).toBe("50 metrów");
    expect(distanceSpeech(t, 257)).toBe("250 metrów");
    expect(distanceSpeech(t, 1234)).toBe("1,2 kilometra");
    expect(distanceSpeech(t, 2000)).toBe("2 kilometry");
  });
});

function guided(parts: { state: RouteSegment["state"]; note?: string | null; length?: number; facts?: AccessibilityFact[] }[]): Route {
  return {
    durationMinutes: 6,
    distanceMeters: 400,
    segments: parts.map((p, i) => ({
      ...segment(p.state, p.note ?? null, p.facts ?? []),
      id: i + 1,
      instruction: ["Kieruj się na południe", "Skręć w lewo na Floriańską", "Skręć w prawo na Rynek"][i] ?? "Idź prosto",
      lengthMeters: p.length ?? 120,
    })),
  } as unknown as Route;
}

describe("announcementSpeech", () => {
  const route = guided([{ state: "met" }, { state: "barrier", note: "krawężnik 4 cm" }, { state: "unknown" }]);

  it("enters a step with its instruction and the distance in words", () => {
    // GIVEN the first step on the first fix
    // WHEN it is said
    const text = announcementSpeech(pl, route, { ids: ["step:0"], cues: [{ kind: "enter", step: 0, now: false, concern: false }] });

    // THEN it is short: instruction, then the rounded distance
    expect(text).toBe("Kieruj się na południe, potem 120 metrów.");
  });

  it("says a turn and the barrier right after it in one breath, rounded for the ear", () => {
    // GIVEN the turn into step 2 and its kerb, 47 m ahead
    const text = announcementSpeech(pl, route, {
      ids: ["turn:1", "concern:1"],
      cues: [
        { kind: "turn", step: 1, inMeters: 47 },
        { kind: "concern", step: 1, inMeters: 47 },
      ],
    });

    // THEN the distance is rounded and the barrier follows as "there", units in words
    expect(text).toBe("Za 50 metrów: skręć w lewo na Floriańską. Tam: bariera, krawężnik 4 centymetry.");
  });

  it("says the manoeuvre now on entering by walking, and repeats the barrier of the step", () => {
    // GIVEN step 2 entered after step 1
    const text = announcementSpeech(pl, route, { ids: ["step:1"], cues: [{ kind: "enter", step: 1, now: true, concern: true }] });

    // THEN it starts with "Teraz" and names the kerb on this segment
    expect(text).toBe("Teraz skręć w lewo na Floriańską, potem 120 metrów. Na tym odcinku: bariera, krawężnik 4 centymetry.");
  });

  it("says a segment nobody checked as no data ahead, never as fine", () => {
    // GIVEN the unchecked last step 30 m ahead
    const text = announcementSpeech(pl, route, { ids: ["concern:2"], cues: [{ kind: "concern", step: 2, inMeters: 30 }] });

    // THEN it says no data
    expect(text).toBe("Za 30 metrów: brak danych, nikt jeszcze nie sprawdził tego odcinka.");
  });

  it("says the destination ahead, off the route and the arrival", () => {
    // GIVEN / WHEN / THEN
    expect(announcementSpeech(pl, route, { ids: ["turn:3"], cues: [{ kind: "turn", step: 3, inMeters: 52 }] })).toBe("Za 50 metrów cel.");
    expect(announcementSpeech(pl, route, { ids: ["off:1"], cues: [{ kind: "offRoute" }] })).toBe(
      "Zboczyłeś z trasy. Wróć na trasę albo wyznacz ją od nowa.",
    );
    expect(announcementSpeech(pl, route, { ids: ["arrived"], cues: [{ kind: "arrived" }] })).toBe("Jesteś u celu.");
  });
});

describe("guidanceSpeech", () => {
  it("says the step, the next turn, the barrier here with its source only when asked, and what's left", () => {
    // GIVEN a walker at the start of step 2, which has a kerb from OpenStreetMap
    const kerb = { ...surface("asphalt"), attribute: "kerb_height_cm" } as AccessibilityFact;
    const route = guided([{ state: "met" }, { state: "barrier", note: "krawężnik 4 cm", facts: [kerb] }, { state: "unknown" }]);
    const progress = { step: 1, toStepEnd: 120, remainingMeters: 240, remainingMinutes: 4, offBy: null, offRoute: false, arrived: false };

    // WHEN it is said without and with the sources
    const short = guidanceSpeech(pl, route, progress, "pl", false);
    const full = guidanceSpeech(pl, route, progress, "pl", true);

    // THEN the short one has no source, the full one names it with a spoken date and its reliability
    expect(short).toBe(
      "Krok 2 z 3. Skręć w lewo na Floriańską. Za 120 metrów: skręć w prawo na Rynek. Na tym odcinku: bariera, krawężnik 4 centymetry. " +
        "Za 120 metrów: brak danych, nikt jeszcze nie sprawdził tego odcinka. Do celu 250 metrów, około 4 minuty.",
    );
    expect(full).toContain("Źródło: OpenStreetMap, 3 października 2026, społeczność.");
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
