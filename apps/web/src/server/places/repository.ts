import type { Category } from "@krakow-bez-barier/contracts";
import { confirmations, facts, places, sources, type Db } from "@krakow-bez-barier/db";
import { and, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { OutageRecord } from "@/domain/outages";
import { getDb } from "../db";
import { createDrizzleOutagesStore } from "../outages/drizzle-store";

export type PlaceRecord = typeof places.$inferSelect;
export type SourceRecord = typeof sources.$inferSelect;
export type FactRecord = typeof facts.$inferSelect & { source: SourceRecord; confirmations: number };

export type PlaceSearch = {
  /** Already normalized with `normalizeText`. */
  text?: string;
  categories?: Category[];
  /** Left out when `categories` is not given (hidden by default). */
  excludeCategories?: Category[];
  /** `[minLon, minLat, maxLon, maxLat]`, WGS84. */
  bbox?: [number, number, number, number];
  /** `[lon, lat]`, WGS84: every hit carries its `distance` from here in metres and the list comes back nearest first. */
  near?: [number, number];
};

/** `distance` (metres, spheroid) is set only for a search with `near`. */
export type PlaceHit = PlaceRecord & { distance?: number };

/** Read access the places service needs; tests pass an in-memory fake. */
export interface PlaceRepository {
  searchPlaces(search: PlaceSearch): Promise<PlaceHit[]>;
  findPlace(id: string): Promise<PlaceRecord | null>;
  /** Active facts of the given places, each with its source and number of confirmations. */
  activeFacts(placeIds: string[]): Promise<FactRecord[]>;
  /** Outages of the given places reported or confirmed at or after `since`, with their votes counted. */
  recentOutages(placeIds: string[], since: Date): Promise<OutageRecord[]>;
}

// Folds Polish letters to ASCII; SQL `translate` below must use the same pairs.
const FOLD_FROM = "ąćęłńóśźż";
const FOLD_TO = "acelnoszz";

/** Lower-case, Polish letters folded to ASCII — the form both the query and the columns are compared in. */
export function normalizeText(text: string): string {
  const lower = text.trim().toLowerCase();
  return [...lower].map((c) => FOLD_TO[FOLD_FROM.indexOf(c)] ?? c).join("");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export function createDbPlaceRepository(db: Db = getDb()): PlaceRepository {
  return {
    async searchPlaces({ text, categories, excludeCategories, bbox, near }) {
      const where: SQL[] = [];
      if (text) {
        const haystack = sql`translate(lower(concat_ws(' ', ${places.name}, ${places.street}, ${places.houseNumber})), ${FOLD_FROM}, ${FOLD_TO})`;
        where.push(sql`${haystack} like ${`%${escapeLike(text)}%`}`);
      }
      if (categories?.length) where.push(inArray(places.category, categories));
      else if (excludeCategories?.length) where.push(notInArray(places.category, excludeCategories));
      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        where.push(sql`ST_Intersects(${places.location}, ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326))`);
      }
      const filter = where.length ? and(...where) : undefined;
      if (!near) return db.select().from(places).where(filter);
      // The bbox predicate above uses the GiST index; the geography distance is evaluated only for the rows it keeps.
      const distance = sql<number>`ST_Distance(${places.location}::geography, ST_SetSRID(ST_MakePoint(${near[0]}, ${near[1]}), 4326)::geography)`;
      const rows = await db.select({ place: places, distance }).from(places).where(filter).orderBy(distance, places.id);
      return rows.map(({ place, distance: meters }) => ({ ...place, distance: Number(meters) }));
    },

    async findPlace(id) {
      if (!UUID.test(id)) return null;
      const [place] = await db.select().from(places).where(eq(places.id, id)).limit(1);
      return place ?? null;
    },

    async activeFacts(placeIds) {
      if (placeIds.length === 0) return [];
      const rows = await db
        .select({
          fact: facts,
          source: sources,
          confirmations: sql<number>`(select count(*)::int from ${confirmations} where ${confirmations.factId} = ${facts.id})`,
        })
        .from(facts)
        .innerJoin(sources, eq(facts.sourceId, sources.id))
        .where(and(inArray(facts.placeId, placeIds), eq(facts.status, "active")));
      return rows.map(({ fact, source, confirmations: count }) => ({ ...fact, source, confirmations: Number(count) }));
    },

    recentOutages: (placeIds, since) => createDrizzleOutagesStore(db).listRecent(placeIds, since),
  };
}
