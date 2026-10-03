import { eventPath } from "./event-link";

export const routes = {
  home: "/",
  place: (id: string) => `/miejsca/${encodeURIComponent(id)}`,
  /** Route screen; `to` is a place id, without it the route ends at Rynek Główny. */
  route: (to?: string) => (to ? `/trasa?do=${encodeURIComponent(to)}` : "/trasa"),
  aboutData: "/o-danych",
  privacy: "/prywatnosc",
  accessibility: "/deklaracja-dostepnosci",
  moderator: "/moderator",
  business: "/dla-firm",
  event: eventPath,
  widget: (placeId: string) => `/widget/${encodeURIComponent(placeId)}`,
  devComponents: "/dev/components",
  devNative: "/dev/native",
} as const;

/** The embeddable widget renders inside venue websites, without the app's chrome. */
export const isWidgetRoute = (pathname: string) => pathname.startsWith(routes.widget(""));
