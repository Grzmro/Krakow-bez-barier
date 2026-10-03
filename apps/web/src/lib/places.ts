"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GetPlaceQuery, ListPlacesQuery } from "@krakow-bez-barier/contracts";
import { api } from "./api";
import { collectPages } from "./nearby";

async function listPlaces(query: ListPlacesQuery) {
  const { data, error } = await api.GET("/places", { params: { query } });
  if (error) throw error;
  return data;
}

/**
 * `GET /places`. Keeps the previous list while a new profile or query loads, so nothing flickers. With
 * `allPages`, follows `nextCursor` (up to a cap) — only for a bounded `bbox`.
 */
export function usePlaces(query: ListPlacesQuery, { allPages = false }: { allPages?: boolean } = {}) {
  return useQuery({
    queryKey: ["places", query, allPages],
    queryFn: () => (allPages ? collectPages((cursor) => listPlaces({ ...query, cursor })) : listPlaces(query)),
    placeholderData: keepPreviousData,
  });
}

/** `GET /places/{id}` for a shared link; `null` when the place doesn't exist (404), so the page can say so. */
export function usePlaceOrNull(id: string) {
  return useQuery({
    queryKey: ["place", id],
    queryFn: async () => {
      const { data, response } = await api.GET("/places/{id}", { params: { path: { id } } });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getPlace ${response.status}`);
      return data;
    },
  });
}

/** `GET /places/{id}`; pass `enabled: false` to defer loading until it's needed. */
export function usePlace(id: string, query: GetPlaceQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["place", id, query],
    queryFn: async () => {
      const { data, error } = await api.GET("/places/{id}", {
        params: { path: { id }, query },
      });
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
