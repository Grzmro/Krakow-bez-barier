"use client";

import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import type { GetPlaceQuery, ListPlacePointsQuery, ListPlacesQuery } from "@krakow-bez-barier/contracts";
import { useLocale } from "@/i18n/client";
import { api } from "./api";

async function listPlaces(query: ListPlacesQuery, signal?: AbortSignal) {
  const { data, error } = await api.GET("/places", { params: { query }, signal });
  if (error) throw error;
  return data;
}

/** `GET /places`. Keeps the previous list while a new profile or query loads, so nothing flickers; a superseded request is aborted. `enabled: false` skips the request. */
export function usePlaces(query: ListPlacesQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["places", locale, query],
    queryFn: ({ signal }) => listPlaces(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * `GET /places` as pages: the first page loads with the query, `fetchNextPage` follows `nextCursor` (same filters, same
 * `near`). Like `usePlaces`, a changed query keeps the previous pages until the new first page arrives.
 */
export function useInfinitePlaces(query: ListPlacesQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const locale = useLocale();
  return useInfiniteQuery({
    queryKey: ["places-pages", locale, query],
    queryFn: ({ signal, pageParam }) => listPlaces(pageParam ? { ...query, cursor: pageParam } : query, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}

const filtersOf =(query: ListPlacePointsQuery | null | undefined) => JSON.stringify({ ...query, bbox: undefined });

/**
 * `GET /places/points`: every matching place in `query.bbox` as a light map point. While another area loads the
 * previous points stay, so a pan never empties the map; points of other filters don't, so they never pass for the
 * new ones (`data` is undefined until those arrive). `null` skips the request.
 */
export function usePlacePoints(query: ListPlacePointsQuery | null) {
  const locale = useLocale();
  const queryKey = ["place-points", locale, query] as const;
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await api.GET("/places/points", { params: { query: query! } });
      if (error) throw error;
      return data;
    },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === locale && filtersOf(previousQuery.queryKey[2]) === filtersOf(query) ? previous : undefined,
    enabled: query !== null,
  });
}

/**
 * `GET /places/{id}`; `null` when the place doesn't exist (404), so a shared link can say so.
 * Pass `enabled: false` to defer loading until it's needed.
 */
export function usePlace(id: string, query: GetPlaceQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const locale = useLocale();
  return useQuery({ ...placeQuery(id, query, locale), enabled });
}

/** `GET /places/{id}` for several places at once, sharing `usePlace`'s cache; one result per id, in order. */
export function usePlacesById(ids: readonly string[], query: GetPlaceQuery) {
  const locale = useLocale();
  return useQueries({ queries: ids.map((id) => placeQuery(id, query, locale)) });
}

function placeQuery(id: string, query: GetPlaceQuery, locale: string) {
  return {
    queryKey: ["place", locale, id, query],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/places/{id}", {
        params: { path: { id }, query },
      });
      if (response.status === 404) return null;
      if (error) throw error;
      return data;
    },
  };
}
