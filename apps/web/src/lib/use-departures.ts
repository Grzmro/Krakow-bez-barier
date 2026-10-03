"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/i18n/client";
import { api } from "./api";
import { DEPARTURES_RADIUS_M } from "./transit";

/** `GET /transit/departures` around `[lon, lat]`; live answers refresh every minute while the card is open. */
export function useDepartures([lon, lat]: [number, number]) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["departures", locale, lon, lat],
    queryFn: async () => {
      const { data, response } = await api.GET("/transit/departures", {
        params: { query: { lat, lon, radius: DEPARTURES_RADIUS_M } },
      });
      if (!data) throw new Error(`listTransitDepartures ${response.status}`);
      return data;
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.mode === "live" ? 60_000 : false),
  });
}
