"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Armchair, Bank, Bed, Bus, Car, Church, Elevator, ForkKnife, MapPin, MaskHappy, Pill, ShoppingBag, Stairs, Toilet, type Icon } from "@phosphor-icons/react";
import type { Category, CategoryDefinition } from "@krakow-bez-barier/contracts";
import { useMessages } from "@/i18n/client";
import { api } from "./api";

/** Icon keys the category and quick action configs may use (`packages/contracts/src/categories.ts`, `quick-actions.ts`); an unknown key shows a pin. */
const ICONS: Record<string, Icon> = {
  "fork-knife": ForkKnife,
  bank: Bank,
  toilet: Toilet,
  bed: Bed,
  church: Church,
  "mask-happy": MaskHappy,
  pill: Pill,
  "shopping-bag": ShoppingBag,
  car: Car,
  bus: Bus,
  "map-pin": MapPin,
  armchair: Armchair,
  elevator: Elevator,
  stairs: Stairs,
};

/** Icon keys the web UI can draw. */
export const ICON_KEYS = Object.keys(ICONS);

export const categoryIcon = (key: string | undefined): Icon => (key && ICONS[key]) || MapPin;

/** `GET /categories`: the categories configured for this deployment, in display order, in the UI language. */
export function useCategories() {
  const names = useMessages().place.categoryNames;
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await api.GET("/categories");
      if (error) throw error;
      return data.items;
    },
    select: (items) => items.map((c) => ({ ...c, ...names[c.id] })),
    staleTime: Infinity,
  });
}

/** Label and icon for a category id; works before the list loads and for ids the list lacks. */
export function useCategoryLookup() {
  const { data } = useCategories();
  const fallback = useMessages().place.category as Record<string, string>;
  return useCallback(
    (id: Category): { label: string; icon: Icon } => {
      const found: CategoryDefinition | undefined = data?.find((c) => c.id === id);
      const fallbackLabel = fallback[id] ?? id;
      return { label: found?.singularLabel ?? fallbackLabel, icon: categoryIcon(found?.icon) };
    },
    [data, fallback],
  );
}
