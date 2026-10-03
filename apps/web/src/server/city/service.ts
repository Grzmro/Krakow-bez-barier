import type { CityStats } from "@krakow-bez-barier/contracts";
import { cityStats, type CityPlace } from "@/domain/city-stats";
import { createDbPlaceRepository, type PlaceRepository } from "@/server/places/repository";
import { resolvePlace } from "@/server/places/service";
import { dbCityReports, type CityReportRecord } from "./repository";

export type CityStatsDeps = {
  places?: PlaceRepository;
  reports?: () => Promise<CityReportRecord[]>;
  now?: Date;
};

/**
 * The city panel's statistics over every real place in the database. Sample (PRZYKŁAD) places, facts from sample
 * sources and reports on sample places are left out, so demo data never shows up as the city's numbers.
 */
export async function getCityStats({ limit }: { limit: number }, deps: CityStatsDeps = {}): Promise<CityStats> {
  const { places: repository = createDbPlaceRepository(), reports: loadReports = dbCityReports(), now = new Date() } = deps;
  const places = (await repository.searchPlaces({})).filter((p) => !p.isSample);
  const [facts, reportRows] = await Promise.all([repository.activeFacts(places.map((p) => p.id)), loadReports()]);
  const factsByPlace = Map.groupBy(
    facts.filter((f) => !f.source.isSample && f.reliability !== "sample"),
    (f) => f.placeId,
  );
  const reportsByPlace = Map.groupBy(reportRows, (r) => r.placeId);

  const input: CityPlace[] = places.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    location: { type: "Point", coordinates: [place.location.x, place.location.y] },
    attributes: resolvePlace(factsByPlace.get(place.id) ?? [], now),
    reports: reportsByPlace.get(place.id) ?? [],
  }));
  return cityStats(input, { now, limit });
}
