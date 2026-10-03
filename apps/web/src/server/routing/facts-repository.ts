import { routeCategoryIds, type AccessibilityAttribute } from "@krakow-bez-barier/contracts";
import { confirmations, facts, places, sources, type Db } from "@krakow-bez-barier/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import type { FactRecord } from "../places/repository";
import { toFact } from "../places/service";
import type { LonLat } from "./provider";
import type { RouteFactsSource } from "./service";

/**
 * Attributes of our own facts that describe the way itself. Entrance facts of places next to the route
 * (steps, doors) are not barriers on it; surface and incline of a place are its own, not the pavement's.
 */
export const ROUTE_FACT_ATTRIBUTES: AccessibilityAttribute[] = ["kerb_height_cm", "stairs"];

/** Facts that count only from the bits of the way (a flight of steps), never from a place's entrance. */
export const ROUTE_CATEGORY_ATTRIBUTES: AccessibilityAttribute[] = ["step_count"];

export type NearbyFactRecord = FactRecord & { location: LonLat };

/** Turns records near the route into facts; shared by the PostGIS source and the tests' fake. */
export function nearbySource(find: (line: LonLat[], meters: number) => Promise<NearbyFactRecord[]>): RouteFactsSource {
  return {
    async factsNear(line, meters, now) {
      const records = await find(line, meters);
      return records.map((record) => ({ fact: toFact(record, now), location: record.location }));
    },
  };
}

export function createDbRouteFacts(db: Db = getDb()): RouteFactsSource {
  return nearbySource(async (line, meters) => {
    const geojson = JSON.stringify({ type: "LineString", coordinates: line });
    const rows = await db
      .select({
        fact: facts,
        source: sources,
        lon: sql<number>`ST_X(${places.location})`,
        lat: sql<number>`ST_Y(${places.location})`,
        confirmations: sql<number>`(select count(*)::int from ${confirmations} where ${confirmations.factId} = ${facts.id})`,
      })
      .from(facts)
      .innerJoin(sources, eq(facts.sourceId, sources.id))
      .innerJoin(places, eq(facts.placeId, places.id))
      .where(
        and(
          eq(facts.status, "active"),
          or(
            inArray(facts.attribute, ROUTE_FACT_ATTRIBUTES),
            and(inArray(facts.attribute, ROUTE_CATEGORY_ATTRIBUTES), inArray(places.category, routeCategoryIds())),
          ),
          sql`ST_DWithin(${places.location}::geography, ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)::geography, ${meters})`,
        ),
      );
    return rows.map(({ fact, source, lon, lat, confirmations: count }) => ({
      ...fact,
      source,
      confirmations: Number(count),
      location: [Number(lon), Number(lat)] as LonLat,
    }));
  });
}
