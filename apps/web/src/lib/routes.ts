export const routes = {
  home: "/",
  place: (id: string) => `/miejsca/${encodeURIComponent(id)}`,
  aboutData: "/o-danych",
  profile: "/profil",
  privacy: "/prywatnosc",
  accessibility: "/deklaracja-dostepnosci",
  moderator: "/moderator",
  business: "/dla-firm",
  widget: (placeId: string) => `/widget/${encodeURIComponent(placeId)}`,
  devComponents: "/dev/components",
  devNative: "/dev/native",
} as const;
