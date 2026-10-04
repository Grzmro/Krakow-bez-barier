import { eventPath } from "./event-link";

export const routes = {
  home: "/",
  place: (id: string) => `/miejsca/${encodeURIComponent(id)}`,
  /**
   * Route screen; `to` is a place id, without it the route ends at Rynek Główny. `from` is the start's `?z=` value
   * (`startParam` in lib/route-start.ts), without it the route starts at the device position (or waits for a chosen start).
   */
  route: (to?: string, from?: string) => {
    const query = [
      to ? `do=${encodeURIComponent(to)}` : null,
      from ? `z=${from.split(",").map(encodeURIComponent).join(",")}` : null,
    ].filter(Boolean);
    return query.length ? `/trasa?${query.join("&")}` : "/trasa";
  },
  /** Routes kept on this device (IndexedDB); precached by public/sw.js so it opens offline. */
  savedRoutes: "/zapisane-trasy",
  /** Day plan: places added from their cards, routed leg by leg; kept in localStorage. */
  plan: "/plan",
  aboutData: "/o-danych",
  dataQuality: "/o-danych/jakosc",
  privacy: "/prywatnosc",
  accessibility: "/deklaracja-dostepnosci",
  moderator: "/moderator",
  city: "/miasto",
  business: "/dla-firm",
  event: eventPath,
  widget: (placeId: string) => `/widget/${encodeURIComponent(placeId)}`,
  devComponents: "/dev/components",
  devNative: "/dev/native",
} as const;

/** The embeddable widget renders inside venue websites, without the app's chrome. */
export const isWidgetRoute = (pathname: string) => pathname.startsWith(routes.widget(""));

/** Pages opened from another one or from a shared link (a place card, an event page): the header shows "back". */
export const isDetailRoute = (pathname: string) =>
  pathname.startsWith(routes.place("")) || pathname.startsWith(routes.event(""));
