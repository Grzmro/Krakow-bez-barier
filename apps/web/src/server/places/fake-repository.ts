import type { FactValue } from "@krakow-bez-barier/contracts";
import {
  normalizeText,
  type FactRecord,
  type PlaceRecord,
  type PlaceRepository,
  type SourceRecord,
} from "./repository";

// In-memory PlaceRepository for tests: same contract as the PostGIS one, filters done in JS.

const AT = new Date("2026-10-01T00:00:00Z");

export function sourceRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "osm",
    name: "OpenStreetMap",
    kind: "community",
    license: "ODbL 1.0",
    termsUrl: null,
    attribution: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org",
    refreshInterval: "daily",
    baseReliability: "community",
    refreshStatus: "ok",
    lastSuccessAt: AT,
    lastAttemptAt: AT,
    statusNote: null,
    isSample: false,
    ...overrides,
  };
}

let seq = 0;

export function placeRecord(overrides: Partial<PlaceRecord> & { name: string }): PlaceRecord {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    externalRef: null,
    category: "museum",
    location: { x: 19.9373, y: 50.0617 },
    street: null,
    houseNumber: null,
    postalCode: null,
    city: "Kraków",
    phone: null,
    website: null,
    email: null,
    entranceHint: null,
    isSample: false,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function factRecord(
  place: PlaceRecord,
  attribute: FactRecord["attribute"],
  value: FactValue,
  overrides: Partial<FactRecord> = {},
): FactRecord {
  seq += 1;
  const source = overrides.source ?? sourceRecord();
  return {
    id: `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`,
    placeId: place.id,
    subject: "place",
    attribute,
    value,
    unit: value.kind === "number" ? (value.unit ?? null) : null,
    sourceId: source.id,
    sourceRecordRef: "node/1",
    fetchedAt: AT,
    observedAt: new Date("2026-09-01T00:00:00Z"),
    confirmedAt: null,
    reliability: source.baseReliability,
    evidence: null,
    status: "active",
    supersededAt: null,
    createdAt: AT,
    confirmations: 0,
    source,
    ...overrides,
  };
}

export function createFakePlaceRepository(places: PlaceRecord[], facts: FactRecord[]): PlaceRepository {
  return {
    async searchPlaces({ text, categories, excludeCategories, bbox }) {
      return places.filter((p) => {
        const haystack = normalizeText([p.name, p.street, p.houseNumber].filter(Boolean).join(" "));
        if (text && !haystack.includes(text)) return false;
        if (categories?.length && !categories.includes(p.category)) return false;
        if (!categories?.length && excludeCategories?.includes(p.category)) return false;
        if (bbox) {
          const [minLon, minLat, maxLon, maxLat] = bbox;
          const { x, y } = p.location;
          if (x < minLon || x > maxLon || y < minLat || y > maxLat) return false;
        }
        return true;
      });
    },
    async findPlace(id) {
      return places.find((p) => p.id === id) ?? null;
    },
    async activeFacts(placeIds) {
      return facts.filter((f) => placeIds.includes(f.placeId) && f.status === "active");
    },
  };
}
