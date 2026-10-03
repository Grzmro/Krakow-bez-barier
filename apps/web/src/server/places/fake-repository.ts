import type { FactValue } from "@krakow-bez-barier/contracts";
import type { OutageRecord } from "@/domain/outages";
import {
  normalizeText,
  type FactRecord,
  type PlaceHit,
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

function haversineMeters([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
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

export function createFakePlaceRepository(places: PlaceRecord[], facts: FactRecord[], outages: OutageRecord[] = []): PlaceRepository {
  return {
    async searchPlaces({ text, categories, excludeCategories, bbox, near }) {
      const hits = places.filter((p) => {
        const haystack = normalizeText([p.name, p.street, p.houseNumber].filter(Boolean).join(" "));
        if (text && !text.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))) return false;
        if (categories?.length && !categories.includes(p.category)) return false;
        if (!categories?.length && excludeCategories?.includes(p.category)) return false;
        if (bbox) {
          const [minLon, minLat, maxLon, maxLat] = bbox;
          const { x, y } = p.location;
          if (x < minLon || x > maxLon || y < minLat || y > maxLat) return false;
        }
        return true;
      });
      if (!near) return hits;
      return hits
        .map((p): PlaceHit => ({ ...p, distance: haversineMeters(near, [p.location.x, p.location.y]) }))
        .sort((a, b) => a.distance! - b.distance! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
    async findPlace(id) {
      return places.find((p) => p.id === id) ?? null;
    },
    async activeFacts(placeIds) {
      return facts.filter((f) => placeIds.includes(f.placeId) && f.status === "active");
    },
    async recentOutages(placeIds, since) {
      return outages.filter((o) => placeIds.includes(o.placeId) && o.lastConfirmedAt.getTime() >= since.getTime());
    },
  };
}
