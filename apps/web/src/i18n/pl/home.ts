import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import type { DistanceFrom } from "@/lib/nearby";

const placesWord = (n: number) =>
  n === 1 ? "miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "miejsca" : "miejsc";
const verdictParts = (parts: [string, number][]) =>
  parts.length ? ` (${parts.map(([label, count]) => `${label}: ${count}`).join(", ")})` : "";

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
  categoryAll: "Wszystko",
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
    cluster: (n: number, parts: [string, number][]) => `Grupa: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    zoomedToCluster: (n: number, parts: [string, number][]) => `Przybliżono: ${n} ${placesWord(n)}${verdictParts(parts)}`,
  },
  list: {
    label: "Lista miejsc",
    stow: { hide: "Schowaj listę", show: "Pokaż listę" },
    results: (n: number) => `${n} ${placesWord(n)}`,
    announce: (n: number) => (n === 0 ? "Nie znaleziono miejsc" : `Znaleziono ${n} ${placesWord(n)}`),
    loading: "Szukam miejsc…",
    error: "Nie udało się pobrać miejsc.",
    retry: "Spróbuj ponownie",
    empty: "Brak miejsc dla tego wyszukiwania.",
    emptyHint: "Spróbuj szerzej: bez nazwy, kategorii i filtrów.",
    searchWider: "Szukaj w całym Krakowie",
    noFeatureMatch: (features: string) =>
      `Żadne miejsce w wynikach nie ma w danych: ${features}. Często po prostu nikt tego nie opisał — brak danych to nie brak udogodnienia.`,
    distance: (m: number, from: DistanceFrom = "centre") =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`} ${
        from === "user" ? "od Ciebie" : from === "chosen" ? "od wybranego punktu" : "od Rynku"
      }`,
  },
} as const;
