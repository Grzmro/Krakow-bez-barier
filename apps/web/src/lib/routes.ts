export const routes = {
  home: "/",
  place: (id: string) => `/miejsca/${encodeURIComponent(id)}`,
  aboutData: "/o-danych",
  privacy: "/prywatnosc",
  accessibility: "/deklaracja-dostepnosci",
  moderator: "/moderator",
  devComponents: "/dev/components",
  devNative: "/dev/native",
} as const;
