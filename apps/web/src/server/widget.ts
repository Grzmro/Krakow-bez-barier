import type { components } from "@krakow-bez-barier/contracts";
import { isStale } from "./domain/resolver";
import { getPlace, type PlacesDeps } from "./places/service";

type WidgetCard = components["schemas"]["WidgetCard"];
type WidgetFact = components["schemas"]["WidgetFact"];
type Profile = components["schemas"]["Profile"];

const OWN_ATTRIBUTION = "Kraków bez barier";

/** The compact, read-only subset of a place for venue websites; same resolved facts as the place card. */
export async function getWidgetCard(
  placeId: string,
  query: { profile?: Profile } = {},
  deps: PlacesDeps = {},
): Promise<WidgetCard | null> {
  const place = await getPlace(placeId, query, deps);
  if (!place) return null;
  const now = deps.now ?? new Date();

  const facts: WidgetFact[] = place.attributes.map((attribute) => {
    // The fact the value comes from: the first fresh one (facts are sorted best first and may include
    // stale ones), or the first fact when everything is stale. A conflict has no single source or date.
    const best =
      attribute.state === "conflict"
        ? undefined
        : (attribute.facts.find((f) => !isStale(f, now)) ?? attribute.facts[0]);
    return {
      attribute: attribute.attribute,
      state: attribute.state,
      value: attribute.value ?? null,
      reliability: best?.reliability ?? null,
      status: attribute.status,
      sourceName: best?.source.name ?? null,
      fetchedAt: best?.fetchedAt ?? null,
    };
  });

  const attributions = [...new Set(place.sources.map((s) => s.attribution).filter((a): a is string => Boolean(a)))];

  return {
    placeId: place.id,
    name: place.name,
    verdict: place.verdict ?? null,
    facts,
    attribution: [OWN_ATTRIBUTION, ...attributions].join(" · "),
    isSample: place.isSample,
  };
}
