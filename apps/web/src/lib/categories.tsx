"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bank, Bed, Church, ForkKnife, MapPin, MaskHappy, Pill, ShoppingBag, Toilet, type Icon } from "@phosphor-icons/react";
import type { Category, CategoryDefinition } from "@krakow-bez-barier/contracts";
import { pl } from "@/i18n/pl";
import { api } from "./api";

/** Icon keys the category config may use (`packages/contracts/src/categories.ts`); an unknown key shows a pin. */
const ICONS: Record<string, Icon> = {
  "fork-knife": ForkKnife,
  bank: Bank,
  toilet: Toilet,
  bed: Bed,
  church: Church,
  "mask-happy": MaskHappy,
  pill: Pill,
  "shopping-bag": ShoppingBag,
  "map-pin": MapPin,
};

/** Icon keys the web UI can draw. */
export const ICON_KEYS = Object.keys(ICONS);

export const categoryIcon = (key: string | undefined): Icon => (key && ICONS[key]) || MapPin;

/** `GET /categories`: the categories configured for this deployment, in display order. */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await api.GET("/categories");
      if (error) throw error;
      return data.items;
    },
    staleTime: Infinity,
  });
}

/** Label and icon for a category id; works before the list loads and for ids the list lacks. */
export function useCategoryLookup() {
  const { data } = useCategories();
  return useCallback(
    (id: Category): { label: string; icon: Icon } => {
      const found: CategoryDefinition | undefined = data?.find((c) => c.id === id);
      const fallbackLabel = (pl.place.category as Record<string, string>)[id] ?? id;
      return { label: found?.singularLabel ?? fallbackLabel, icon: categoryIcon(found?.icon) };
    },
    [data],
  );
}
