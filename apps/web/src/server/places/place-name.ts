import { cache } from "react";
import { isMockApi } from "@/lib/api";
import { isDbConfigured } from "@/server/db";
import { createDbPlaceRepository, type PlaceRepository } from "./repository";

export type PlaceNameDeps = { mock?: boolean; repository?: () => PlaceRepository | null };

const defaultRepository = () => (isDbConfigured() ? createDbPlaceRepository() : null);

/**
 * The place's name for the card's `<title>` and its 404: one row, no facts. `null` when there is no such place;
 * `undefined` when we can't tell (no database, or it failed) — the card then renders and reports its own state.
 * In the example-data mode the place comes from the spec's examples, as in the browser mock.
 */
export async function findPlaceName(id: string, deps: PlaceNameDeps = {}): Promise<string | null | undefined> {
  const { mock = isMockApi, repository = defaultRepository } = deps;
  if (mock) {
    const { EXAMPLE_PLACES } = await import("@/lib/mocks/mock-api");
    return EXAMPLE_PLACES.find((p) => p.id === id)?.name ?? null;
  }
  const repo = repository();
  if (!repo) return undefined;
  try {
    return (await repo.findPlace(id))?.name ?? null;
  } catch (error) {
    console.error("place name lookup failed", error);
    return undefined;
  }
}

/** `findPlaceName` once per request: the page and its metadata share the lookup. */
export const placeName = cache((id: string) => findPlaceName(id));
