"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/i18n/client";
import { api } from "@/lib/api";

/** The embeddable card for a place; `null` when the place doesn't exist. Waits while `placeId` is undefined. */
export function useWidgetCard(placeId: string | undefined) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["widget", locale, placeId],
    enabled: placeId !== undefined,
    queryFn: async () => {
      if (placeId === undefined) throw new Error("useWidgetCard: no placeId");
      const { data, response } = await api.GET("/widget/{placeId}", { params: { path: { placeId } } });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getWidgetCard ${response.status}`);
      return data;
    },
  });
}
