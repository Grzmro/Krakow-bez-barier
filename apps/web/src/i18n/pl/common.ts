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
    aboutData: "O danych",
    aboutDataSub: "Źródła, licencje, wiarygodność",
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
  },
  bottomPanel: {
    expand: "Rozwiń arkusz",
    collapse: "Zwiń arkusz",
  },
} as const;
