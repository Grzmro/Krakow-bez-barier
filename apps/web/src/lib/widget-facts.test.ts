import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { widgetFactView } from "./widget-facts";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: createMockFetch() });

describe("widgetFactView", () => {
  it("shows values with source and date, and names missing data instead of implying access", async () => {
    // GIVEN the demo hotel's widget card from the spec examples
    const { data } = await api.GET("/widget/{placeId}", { params: { path: { placeId: "hotel-przyklad" } } });
    if (!data) throw new Error("no widget example");

    // WHEN its facts are turned into widget rows
    const rows = data.facts.map((fact) => widgetFactView(fact, "pl"));
    const byAttribute = Object.fromEntries(rows.map((r) => [r.attribute, r]));

    // THEN known facts carry the formatted value, reliability and their source with the date
    expect(byAttribute.door_width_cm).toMatchObject({
      value: "90 cm",
      reliability: "confirmed",
      source: "Dane obiektu · 12.09.2026",
      unknown: false,
    });
    expect(byAttribute.step_count).toMatchObject({ value: "Bez stopni", unknown: false });
    expect(byAttribute.toilet_accessible).toMatchObject({ value: "Jest", reliability: "confirmed" });
    // AND the lift from OpenStreetMap stays unverified
    expect(byAttribute.lift).toMatchObject({
      value: "Jest",
      reliability: "unverified",
      source: "OpenStreetMap · 3.10.2026",
    });
    // AND the changing table is "Brak danych", neutral, with no source
    expect(byAttribute.changing_table).toEqual({
      attribute: "changing_table",
      label: "Przewijak",
      value: "Brak danych",
      reliability: "unknown",
      unknown: true,
    });
  });

  it("treats a fact without a value as unknown even if its state says otherwise", () => {
    // GIVEN a malformed fact: state known but no value
    const fact = { attribute: "lift", state: "known", status: "confirmed", value: null } as const;

    // WHEN it is turned into a row
    const row = widgetFactView(fact, "pl");

    // THEN it reads as missing data, never as a confirmed lift
    expect(row).toMatchObject({ value: "Brak danych", reliability: "unknown", unknown: true });
  });

  it("does not present one side of a conflict as the fact", () => {
    // GIVEN a conflicting toilet fact that carries only one source's value
    const fact = {
      attribute: "toilet_accessible",
      state: "conflict",
      status: "conflict",
      value: { kind: "boolean", boolean: true },
      reliability: "community",
      sourceName: "OpenStreetMap",
      fetchedAt: "2026-10-03T03:00:00Z",
    } as const;

    // WHEN it is turned into a row
    const row = widgetFactView(fact, "pl");

    // THEN it says the sources differ and points to the full card, without either value
    expect(row).toEqual({
      attribute: "toilet_accessible",
      label: "Toaleta dostosowana",
      value: "Źródła się różnią",
      reliability: "conflict",
      source: "Obie wartości ze źródłami — w pełnej karcie.",
      unknown: false,
    });
  });
});
