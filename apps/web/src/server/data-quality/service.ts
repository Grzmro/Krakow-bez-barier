import type { DataQualityReport } from "@krakow-bez-barier/contracts";
import { CITY_EXCLUDED_CATEGORIES } from "@/domain/city-stats";
import { dataQuality } from "@/domain/data-quality";
import { createDbPlaceRepository, type PlaceRepository } from "@/server/places/repository";
import { resolvePlace } from "@/server/places/service";

export type DataQualityDeps = { places?: PlaceRepository; now?: Date };

/**
 * The data quality report over every real place in the database except the bulk categories hidden on the map (the same
 * scope as the city panel). Sample (PRZYKŁAD) places and facts from sample sources are left out, so demo data never
 * shows up as the quality of the real data. Personal data is not read: only places and their facts.
 */
export async function getDataQuality(deps: DataQualityDeps = {}): Promise<DataQualityReport> {
  const { places: repository = createDbPlaceRepository(), now = new Date() } = deps;
  const places = (await repository.searchPlaces({ excludeCategories: CITY_EXCLUDED_CATEGORIES })).filter((p) => !p.isSample);
  const facts = await repository.activeFacts(places.map((p) => p.id));
  const factsByPlace = Map.groupBy(
    facts.filter((f) => !f.source.isSample && f.reliability !== "sample"),
    (f) => f.placeId,
  );
  return dataQuality(
    places.map((place) => ({ category: place.category, attributes: resolvePlace(factsByPlace.get(place.id) ?? [], now) })),
    { now },
  );
}
