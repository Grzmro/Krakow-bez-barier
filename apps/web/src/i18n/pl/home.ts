import type { Category, FeatureFilter } from "@krakow-bez-barier/contracts";

const placesWord = (n: number) =>
  n === 1 ? "miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "miejsca" : "miejsc";

export type HomeCategory = "all" | Extract<Category, "restaurant" | "museum" | "toilet" | "hotel">;

export const home = {
  title: "Mapa i lista miejsc",
  skipToList: "Przejdź do listy",
  search: {
    label: "Wyszukaj miejsce",
    placeholder: "Dokąd?",
    suggestions: "Podpowiedzi",
    clear: "Wyczyść wyszukiwanie",
  },
  categoriesLabel: "Kategorie",
  categories: {
    all: "Wszystko",
    restaurant: "Restauracje",
    museum: "Muzea",
    toilet: "Toalety",
    hotel: "Hotele",
  } satisfies Record<HomeCategory, string>,
  filtersLabel: "Filtry cech",
  filters: {
    step_free: "Bez schodów",
    lift: "Winda",
    toilet_accessible: "Toaleta dostosowana",
    bench: "Ławki",
    disabled_parking: "Parking N",
    changing_table: "Przewijak",
  } satisfies Record<FeatureFilter, string>,
  showUnknown: "Pokaż też miejsca bez danych",
  map: {
    label: "Mapa miejsc. Strzałki przesuwają widok, plus i minus zmieniają przybliżenie. Lista zawiera te same miejsca.",
    zoomIn: "Przybliż",
    zoomOut: "Oddal",
    unavailable: "Mapa jest niedostępna w tej przeglądarce. Wszystkie miejsca są na liście.",
  },
  list: {
    label: "Lista miejsc",
    results: (n: number) => `${n} ${placesWord(n)}`,
    announce: (n: number) => (n === 0 ? "Nie znaleziono miejsc" : `Znaleziono ${n} ${placesWord(n)}`),
    loading: "Szukam miejsc…",
    error: "Nie udało się pobrać miejsc.",
    retry: "Spróbuj ponownie",
    empty: "Brak miejsc dla tego wyszukiwania.",
    emptyHint: "Spróbuj szerzej: bez nazwy, kategorii i filtrów.",
    searchWider: "Szukaj w całym Krakowie",
    distance: (m: number) => `${m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`} od Rynku`,
  },
} as const;
