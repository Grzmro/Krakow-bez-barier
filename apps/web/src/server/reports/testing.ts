import { createMemoryReportsStore } from "./memory-store";

export const PLACE_ID = "6f1c9a52-8d3e-4b7a-9c1d-2e5f8a7b3c40";
export const OTHER_PLACE_ID = "0b7e4d21-3c9f-4a8e-b6d5-1f2a3b4c5d6e";
export const LIFT_FACT_ID = "a3d5f7e9-1b2c-4d6e-8f0a-1c3e5a7b9d2f";

/** A memory store with one place whose lift is known from OpenStreetMap, and a second place without facts. */
export function seededReportsStore() {
  return createMemoryReportsStore({
    places: [
      { id: PLACE_ID, name: "Podziemia Rynku", externalRef: "osm:way/123" },
      { id: OTHER_PLACE_ID, name: "Muzeum Archeologiczne" },
    ],
    facts: [
      {
        id: LIFT_FACT_ID,
        placeId: PLACE_ID,
        recordRef: "osm:way/123",
        attribute: "lift",
        value: { kind: "boolean", boolean: true },
        unit: null,
        source: { id: "osm", name: "OpenStreetMap", kind: "community", recordRef: "osm:way/123" },
        fetchedAt: "2026-10-01T00:00:00.000Z",
        observedAt: null,
        confirmedAt: null,
        reliability: "community",
        evidence: null,
        status: "active",
        stale: false,
      },
    ],
  });
}

export const jsonRequest = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
