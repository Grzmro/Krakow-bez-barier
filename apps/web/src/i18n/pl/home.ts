import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import type { DistanceFrom } from "@/lib/nearby";
import type { QuickActionId } from "@/lib/quick-actions";

const placesWord = (n: number) =>
  n === 1 ? "miejsce" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "miejsca" : "miejsc";
const verdictParts = (parts: [string, number][]) =>
  parts.length ? ` (${parts.map(([label, count]) => `${label}: ${count}`).join(", ")})` : "";

export const home = {
  title: "Mapa i lista miejsc",
  skipToList: "Przejdź do listy",
  backToMap: "Wróć do całej mapy",
  search: {
    label: "Wyszukaj miejsce",
    placeholder: "Dokąd?",
    suggestions: "Podpowiedzi",
    categorySuggestion: (label: string) => `Kategoria: ${label}`,
    clear: "Wyczyść wyszukiwanie",
    route: {
      prompt: (name: string) => `Chcesz dojść do: ${name}?`,
      button: "Wyznacz trasę",
      aria: (name: string) => `Wyznacz trasę do: ${name}`,
    },
    voice: {
      start: "Wpisz głosem",
      listening: "Słucham… mów teraz",
      processing: "Rozpoznaję mowę…",
      notice: "Mowę rozpoznaje Twoja przeglądarka — może wysłać nagranie do usługi swojego dostawcy (np. Google w Chrome); my nic nie zapisujemy.",
      notAllowedApp:
        "Brak dostępu do mikrofonu. Włącz go w Ustawienia → Aplikacje → Kraków bez barier → Uprawnienia → Mikrofon. Wyszukiwanie tekstem nadal działa.",
      errors: {
        "not-allowed": "Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki i spróbuj ponownie.",
        "no-speech": "Nic nie usłyszałem. Naciśnij mikrofon i powiedz, czego szukasz.",
        network: "Rozpoznawanie mowy wymaga internetu. Sprawdź połączenie albo wpisz zapytanie.",
        other: "Nie udało się rozpoznać mowy. Spróbuj ponownie albo wpisz zapytanie.",
      },
    },
  },
  command: {
    applied: (what: string) => `Pokazuję: ${what}, od najbliższych`,
    unknownTitle: "Nie rozumiem tego polecenia.",
    unknownHint: "Spróbuj: „najbliższa toaleta”, „apteka w pobliżu” albo „winda koło mnie”.",
  },
  categoriesLabel: "Kategorie",
  categoryAll: "Wszystko",
  filtersLabel: "Filtry cech",
  filters: {
    step_free: "Bez schodów",
    lift: "Winda",
    toilet_accessible: "Toaleta dostosowana",
    bench: "Ławki",
    disabled_parking: "Parking dla niepełnosprawnych",
    changing_table: "Przewijak",
  } satisfies Record<FeatureFilter, string>,
  showUnknown: "Pokaż też miejsca bez danych",
  confirm: {
    label: "Zatwierdzenie wyborów",
    summary: (choices: string) => `Wybrano: ${choices}`,
    nearby: "w mojej okolicy",
    show: "Pokaż wyniki",
    showCount: (n: number) => `Pokaż wyniki (${n})`,
    clear: "Wyczyść wybór i wróć do mapy",
    countAnnounce: (n: number) => (n === 0 ? "Żadne miejsce nie pasuje do wyborów" : `Do wyborów pasuje ${n} ${placesWord(n)}`),
  },
  map: {
    label: "Mapa miejsc. Strzałki przesuwają widok, plus i minus zmieniają przybliżenie. Lista zawiera te same miejsca.",
    zoomIn: "Przybliż",
    zoomOut: "Oddal",
    locate: "Pokaż moją lokalizację",
    locating: "Ustalam Twoją pozycję…",
    located: "Mapa pokazuje Twoją pozycję.",
    here: "Jesteś tutaj",
    sources: "Źródła mapy",
    sourcesLabel: "Informacje o źródłach mapy",
    unavailable: "Mapa jest niedostępna w tej przeglądarce. Wszystkie miejsca są na liście.",
    cluster: (n: number, parts: [string, number][]) => `Grupa: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    zoomedToCluster: (n: number, parts: [string, number][]) => `Przybliżono: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    inView: (n: number) => `W widoku: ${n} ${placesWord(n)}.`,
    pinsCut: (shown: number, total: number) =>
      `Mapa pokazuje ${shown} z ${total} miejsc w tym obszarze. Przybliż mapę albo zawęź wyszukiwanie, żeby zobaczyć pozostałe.`,
    pin: (name: string, category: string, status: string | null) => [name, category, status].filter(Boolean).join(" · "),
  },
  quick: {
    label: "Szybkie akcje",
    actions: {
      toilet: { label: "Najbliższa toaleta", result: "Najbliższa toaleta dostosowana" },
      rest: { label: "Miejsce odpoczynku", result: "Najbliższe miejsce z ławką" },
      lift: { label: "Najbliższa winda", result: "Najbliższe miejsce z windą" },
      pharmacy: { label: "Najbliższa apteka", result: "Najbliższa apteka bez schodów" },
      transit_stop: { label: "Najbliższy przystanek", result: "Najbliższy przystanek" },
    } satisfies Record<QuickActionId, { label: string; result: string }>,
    needLocation: "Żeby znaleźć najbliższe, włącz „W mojej okolicy” albo wybierz dzielnicę.",
    searching: "Szukam najbliższego…",
    none: (result: string) => `${result}: brak w okolicy (ok. 2 km) według danych.`,
    noneHint: "Miejsca bez danych o dostępności nie liczą się jako dostępne. Możesz je pokazać na liście poniżej.",
    found: (result: string, name: string, distance: string) => `${result}: ${name}, ${distance}`,
    guide: "Prowadź",
    details: "Szczegóły",
    loadingFacts: "Wczytuję fakty…",
  },
  list: {
    label: "Lista miejsc",
    start: { summary: "Najbliższe miejsca", hint: "Mapa jest czysta. Wpisz nazwę i naciśnij Enter, wybierz szybką akcję albo zaznacz kategorię i cechy, a potem „Pokaż wyniki”. Wtedy pojawią się lista i pinezki.", nearYou: "Najbliżej Ciebie", nearChosen: "Najbliżej wybranego punktu", nearCentre: "Najbliżej Rynku (bez lokalizacji)", empty: "Brak miejsc w okolicy." },
    stow: { hide: "Schowaj listę", show: "Pokaż listę" },
    filtersJump: "Filtry i profil",
    results: (n: number) => `${n} ${placesWord(n)}`,
    firstOf: (shown: number, total: number) => `Lista: pierwsze ${shown} z ${total} ${placesWord(total)}`,
    announcePartial: (shown: number, total: number) =>
      `W widoku ${total} ${placesWord(total)}, na liście pierwsze ${shown}. „Pokaż więcej” wczyta kolejne`,
    announce: (n: number) => (n === 0 ? "Nie znaleziono miejsc" : `Znaleziono ${n} ${placesWord(n)}`),
    loading: "Szukam miejsc…",
    error: "Nie udało się pobrać miejsc.",
    retry: "Spróbuj ponownie",
    empty: "Brak miejsc dla tego wyszukiwania.",
    emptyHint: "Spróbuj szerzej: bez nazwy, kategorii i filtrów.",
    searchWider: "Szukaj w całym Krakowie",
    licenceHold: {
      parking: "Dane o miejscach postojowych czekają na potwierdzenie licencji ZDMK.",
      link: "O danych",
    },
    more: (shown: number, total: number) => `Pokaż więcej miejsc (${shown} z ${total})`,
    noFeatureMatch: (features: string) =>
      `Żadne miejsce w wynikach nie ma w danych: ${features}. Często po prostu nikt tego nie opisał — brak danych to nie brak udogodnienia.`,
    distance: (m: number, from: DistanceFrom = "centre") =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`} ${
        from === "user" ? "od Ciebie" : from === "chosen" ? "od wybranego punktu" : "od Rynku"
      }`,
  },
} as const;
