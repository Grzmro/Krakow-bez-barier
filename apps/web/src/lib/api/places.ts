"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { operations } from "@krakow-bez-barier/contracts";
import { api } from "./client";

type ListPlacesQuery = NonNullable<operations["listPlaces"]["parameters"]["query"]>;
type GetPlaceQuery = NonNullable<operations["getPlace"]["parameters"]["query"]>;

/** `GET /places`. Keeps the previous list while a new profile or query loads, so nothing flickers. */
export function usePlaces(query: ListPlacesQuery) {
  return useQuery({
    queryKey: ["places", query],
    queryFn: async () => {
      const { data, error } = await api.GET("/places", { params: { query } });
      if (error) throw error;
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

/** `GET /places/{id}`; pass `enabled: false` to defer loading until it's needed. */
export function usePlace(id: string, query: GetPlaceQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["place", id, query],
    queryFn: async () => {
      const { data, error } = await api.GET("/places/{id}", { params: { path: { id }, query } });
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
