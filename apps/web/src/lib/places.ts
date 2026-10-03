"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GetPlaceQuery, ListPlacesQuery } from "@krakow-bez-barier/contracts";
import { useLocale } from "@/i18n/client";
import { api } from "./api";

async function listPlaces(query: ListPlacesQuery) {
  const { data, error } = await api.GET("/places", { params: { query } });
  if (error) throw error;
  return data;
}

/** `GET /places`. Keeps the previous list while a new profile or query loads, so nothing flickers. `enabled: false` skips the request. */
export function usePlaces(query: ListPlacesQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["places", locale, query],
    queryFn: () => listPlaces(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * `GET /places/{id}`; `null` when the place doesn't exist (404), so a shared link can say so.
 * Pass `enabled: false` to defer loading until it's needed.
 */
export function usePlace(id: string, query: GetPlaceQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["place", locale, id, query],
    queryFn: async () => {
      const { data, error, response } = await api.GET("/places/{id}", {
        params: { path: { id }, query },
      });
      if (response.status === 404) return null;
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
