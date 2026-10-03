import type { AccessibilityAttribute, Category, Reliability, components } from "@krakow-bez-barier/contracts";

type SourceKind = components["schemas"]["SourceKind"];
type SourceRefreshStatus = components["schemas"]["SourceRefreshStatus"];

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}

// Place card (`/miejsca/[id]`).
export const place = {
  pageTitle: "Karta miejsca",
  loading: "Wczytujemy kartę miejsca…",
  loadError: "Nie udało się wczytać karty miejsca. Spróbuj ponownie za chwilę.",
  retry: "Spróbuj ponownie",
  notFound: "Nie znaleźliśmy tego miejsca",
  notFoundHint: "Link może być nieaktualny albo miejsce zostało usunięte.",
  goHome: "Wróć do wyszukiwania",
  noPhoto: "Brak zdjęcia",
  location: "Jak dojść do wejścia",
  noEntranceHint: "Brak wskazówki, jak dojść do wejścia.",
  share: "Udostępnij",
  shared: "Link do karty skopiowany",
  shareFailed: "Nie udało się skopiować linku",
  contact: "Zapytaj obiekt",
  contactHint: "Czegoś nie wiadomo? Zapytaj obiekt albo uzupełnij.",
  phone: "Telefon",
  www: "Strona",
  email: "E-mail",
  fill: "Uzupełnij",
  fillSoon: "Formularz uzupełniania danych jest w przygotowaniu.",
  facts: "Fakty",
  factsHint: "Pokazujemy konkretne dane, bez zbiorczej oceny. Rozwiń cechę, aby zobaczyć źródło i datę.",
  aboutData: "O danych",
  sourcesCount: (n: number, latest?: string) =>
    `${n} ${plural(n, "źródło", "źródła", "źródeł")}${latest ? ` · najnowsze ${latest}` : ""}`,
  outage: {
    title: (date: string) => `Odświeżenie nie powiodło się — dane z ${date}`,
    titleNoDate: "Odświeżenie nie powiodło się — brak wcześniejszych danych",
    source: (name: string) => `Źródło: ${name}`,
  },
  conflict: {
    title: "Źródła podają sprzeczne dane",
    body: (attributes: string) => `Dotyczy: ${attributes}. Pokazujemy obie wartości ze źródłami — sprawdź na miejscu albo zapytaj obiekt.`,
  },
  why: {
    title: "Skąd wiemy?",
    lead: "Źródła danych o tym miejscu, ich licencje i stan odświeżenia.",
    none: "Nie mamy jeszcze żadnego źródła dla tego miejsca.",
    license: "Licencja",
    lastSuccess: "Ostatnie udane pobranie",
    never: "jeszcze nie pobrano",
  },
  sourceKind: {
    official_open_data: "Dane urzędowe",
    community: "Społeczność",
    venue_owner: "Zarządca obiektu",
    user_report: "Zgłoszenia użytkowników",
    sample: "Dane przykładowe",
  } satisfies Record<SourceKind, string>,
  refreshStatus: {
    ok: "Działa",
    stale: "Opóźnione odświeżanie",
    outage: "Niedostępne",
    never: "Jeszcze nie pobrano",
  } satisfies Record<SourceRefreshStatus, string>,
  level: {
    confirmed: "potwierdzone przez urząd lub zarządcę",
    community: "społeczność",
    extracted: "odczytane automatycznie",
    user_report: "zgłoszenie użytkownika",
    inferred: "wywnioskowane",
    sample: "przykład",
  } satisfies Record<Reliability, string>,
  lastConfirmed: (date: string) => `ostatnio potwierdzone ${date}`,
  confirmations: (n: number) => `${n}/2 potwierdzeń`,
  communityConfirmed: "potwierdzone przez społeczność",
  category: {
    restaurant: "Restauracja",
    museum: "Muzeum",
    toilet: "Toaleta",
    hotel: "Hotel",
    monument: "Zabytek",
    theatre: "Teatr",
    shop: "Handel",
    other: "Inne",
  } satisfies Record<Category, string>,
  attribute: {
    step_count: "Wejście — stopnie",
    step_height_cm: "Wysokość stopnia",
    threshold_cm: "Próg",
    ramp: "Podjazd",
    lift: "Winda",
    door_width_cm: "Szerokość drzwi",
    entrance_level: "Poziom wejścia",
    toilet_accessible: "Toaleta dostosowana",
    changing_table: "Przewijak",
    surface: "Nawierzchnia dojścia",
    smoothness: "Równość nawierzchni",
    incline_pct: "Nachylenie",
    kerb_height_cm: "Wysokość krawężnika",
    bench: "Miejsca odpoczynku",
    disabled_parking: "Parking dla osób z niepełnosprawnościami",
    wheelchair_overall: "Ogólna dostępność (OSM)",
  } satisfies Record<AccessibilityAttribute, string>,
  value: {
    yes: "Jest",
    no: "Nie ma",
    noSteps: "Bez stopni",
    steps: (n: number) => `${n} ${plural(n, "stopień", "stopnie", "stopni")}`,
    separator: " / ",
  },
  unit: { cm: "cm", pct: "%", m: "m", count: "" },
  surface: {
    flat: "równa",
    asphalt: "asfalt",
    paving_stones: "płyty chodnikowe",
    concrete: "beton",
    cobblestone: "kostka brukowa",
    sett: "kostka kamienna",
    gravel: "żwir",
    grass: "trawa",
  } as Record<string, string>,
} as const;
