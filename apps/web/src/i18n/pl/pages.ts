import type { Reliability } from "@krakow-bez-barier/ui";
import type { components } from "@krakow-bez-barier/contracts";

type SourceKind = components["schemas"]["SourceKind"];
type SourceRefreshStatus = components["schemas"]["SourceRefreshStatus"];

// Info pages: O danych, Prywatność, Deklaracja dostępności.
export const pages = {
  back: "Wróć na stronę główną",
  aboutData: {
    title: "O danych",
    lead: "Każda cecha ma źródło, datę i status wiarygodności. Nie liczymy jednej oceny miejsca.",
    sources: "Źródła",
    loading: "Wczytuję listę źródeł…",
    loaded: (count: number) => `Wczytano listę źródeł danych: ${count}.`,
    error: "Nie udało się wczytać listy źródeł. Pozostałe informacje na tej stronie są aktualne.",
    retry: "Spróbuj ponownie",
    sampleNote: "Status źródeł pochodzi z danych przykładowych, dopóki nie działa serwer danych.",
    license: "Licencja",
    attribution: "Atrybucja",
    refresh: "Odświeżanie",
    verification: "Weryfikacja",
    lastOk: "Ostatnia udana aktualizacja",
    lastAttempt: "Ostatnia próba",
    never: "jeszcze nigdy",
    website: (name: string) => `Strona źródła: ${name}`,
    status: {
      ok: "Działa",
      stale: "Opóźnione",
      outage: "Niedostępne",
      never: "Jeszcze nie pobrano",
    } satisfies Record<SourceRefreshStatus, string>,
    refreshInterval: {
      hourly: "co godzinę",
      daily: "codziennie",
      weekly: "co tydzień",
      monthly: "co miesiąc",
      realtime: "na bieżąco",
    } as Record<string, string>,
    verificationByKind: {
      official_open_data: "zarządca lub miasto",
      community: "społeczność, potwierdzenia użytkowników",
      venue_owner: "deklaracja właściciela, moderacja",
      user_report: "moderacja zgłoszeń",
      sample: "dane przykładowe, bez weryfikacji",
    } satisfies Record<SourceKind, string>,
    rulesTitle: "Jak liczymy wiarygodność",
    rules: {
      confirmed: "dane zarządcy lub miasta, albo 2 potwierdzenia od społeczności",
      unverified: "jedno źródło społeczności albo zgłoszenie",
      outdated: "ostatnie potwierdzenie starsze niż 12 miesięcy",
      conflict: "dwa źródła podają różne wartości; pokazujemy oba",
      unknown: "nikt jeszcze nie sprawdził; nigdy nie liczymy tego jako „spełnia”",
    } satisfies Record<Reliability, string>,
    dateLocale: "pl-PL",
    timeZone: "Europe/Warsaw",
    osmAttribution: "Dane mapy © OpenStreetMap contributors, licencja ODbL.",
  },
  privacy: {
    title: "Prywatność",
    lead: "Nie pytamy o zdrowie ani niepełnosprawność. Nie mamy kont.",
    sections: [
      [
        "Co zbieramy",
        "Treść zgłoszeń i potwierdzeń: cecha, wartość, opcjonalny komentarz i data. Bez imienia, e-maila, adresu IP i lokalizacji.",
      ],
      ["Po co", "Żeby poprawić dane o dostępności miejsc. Zgłoszenie widzi moderator, a po zatwierdzeniu wszyscy."],
      ["Jak długo", "Zgłoszenia przechowujemy 24 miesiące, potem zostaje tylko zatwierdzona wartość i data."],
      [
        "Ustawienia",
        "Profil i progi zapisujemy tylko w Twojej przeglądarce. Możesz je usunąć, czyszcząc dane strony.",
      ],
      ["Trackery", "Nie używamy reklam, analityki śledzącej ani pikseli zewnętrznych."],
    ] as [string, string][],
  },
  a11y: {
    title: "Deklaracja dostępności",
    lead: "Prototyp „Kraków bez barier” (HackYeah 2026). Cel: WCAG 2.2 AA. Stan na 3.10.2026.",
    works: "Co działa",
    worksList: [
      "Obsługa klawiaturą, widoczny fokus, link „Przejdź do treści”.",
      "Lista miejsc jako tekstowy odpowiednik mapy.",
      "Statusy jako tekst, ikona i kształt, nie tylko kolor.",
      "Ogłaszanie liczby wyników po zmianie filtra lub profilu.",
      "Cele dotykowe min. 48 px, kontrast tekstu min. 4,5:1.",
      "Ograniczony ruch przy ustawieniu „zmniejsz ruch”.",
      "Automatyczne testy axe (WCAG 2.2 A/AA) każdego ekranu.",
    ],
    limits: "Znane ograniczenia",
    limitsList: [
      "Mapa jest poglądowa i nie ma etykiet dla czytnika ekranu — te same informacje są na liście.",
      "Część danych jest przykładowa; oznaczamy ją „PRZYKŁAD”.",
      "Brak wersji angielskiej.",
      "Nie testowaliśmy jeszcze z użytkownikami czytników ekranu.",
    ],
    plan: "Plan usunięcia ograniczeń",
    planList: [
      "Przed pilotażem: audyt WCAG 2.2 AA i testy z czytnikami ekranu (VoiceOver, NVDA).",
      "W pilotażu: testy z osobami na wózkach i rodzicami z wózkami.",
      "Po pilotażu: wersja angielska.",
    ],
    contact: "Uwagi o dostępności zgłoś zespołowi projektu — poprawimy je przed pilotażem.",
  },
} as const;
