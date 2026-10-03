import type { AccessibilityAttribute } from "@krakow-bez-barier/contracts";
import type { Reliability, Status } from "@krakow-bez-barier/ui";

// App shell and shared components. Screen-specific copy goes in its own file next to this one.
export const common = {
  app: {
    name: "Kraków bez barier",
    description:
      "Sprawdź, czy miejsce w Krakowie pasuje do Twoich potrzeb — konkretne bariery i udogodnienia, każda informacja ze źródłem i datą.",
    close: "Zamknij",
    back: "Wstecz",
  },
  layout: {
    skipToContent: "Przejdź do treści",
    sampleBanner: "PRZYKŁAD — prototyp, dane mogą być przykładowe",
    mainNav: "Nawigacja główna",
    homeLink: "Kraków bez barier — strona główna",
    openMenu: "Menu",
  },
  menu: {
    title: "Menu",
    description: "Strony dodatkowe",
    profile: "Profil potrzeb",
    profileSub: "Wózek, wózek dziecięcy, progi",
    aboutData: "O danych",
    aboutDataSub: "Źródła, licencje, wiarygodność",
    business: "Dla firm: widget i API",
    businessSub: "Karta dostępności na Twojej stronie",
    moderator: "Panel moderatora",
    moderatorSub: "Kolejka zgłoszeń",
    privacy: "Prywatność",
    privacySub: "Co zbieramy i na jak długo",
    a11y: "Deklaracja dostępności",
    a11ySub: "Co działa, znane ograniczenia",
  },
  status: {
    met: "Spełnia",
    barrier: "Nie spełnia",
    conflict: "Sprzeczne",
    unknown: "Brak danych",
  } satisfies Record<Status, string>,
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
  unconfirmed: "niepotwierdzone",
  reliability: {
    confirmed: "Potwierdzone",
    unverified: "Niezweryfikowane",
    outdated: "Nieaktualne",
    conflict: "Sprzeczne",
    unknown: "Brak danych",
  } satisfies Record<Reliability, string>,
  sample: {
    tag: "Przykład",
    aria: "Dane przykładowe",
  },
  fact: {
    source: "Źródło",
    acquired: "Pozyskano",
    noValue: "Brak danych",
    noSources: "Nikt jeszcze nie sprawdził.",
    maybeOutdated: (date: string) => `Może być nieaktualne · ${date}`,
    aria: (label: string, value: string, reliability: string, status?: string) =>
      `${label}: ${value}. ${status ? `${status}. ` : ""}Wiarygodność: ${reliability}.`,
  },
  bottomPanel: {
    expand: "Rozwiń arkusz",
    collapse: "Zwiń arkusz",
  },
} as const;
