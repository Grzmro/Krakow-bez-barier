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
      yearly: "co rok",
      realtime: "na bieżąco",
    } satisfies Record<string, string>,
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
        "Profil, progi i język zapisujemy tylko w Twojej przeglądarce. Możesz je usunąć, czyszcząc dane strony.",
      ],
      ["Trackery", "Nie używamy reklam, analityki śledzącej ani pikseli zewnętrznych."],
    ] as [string, string][],
  },
  a11y: {
    title: "Deklaracja dostępności",
    lead: "Prototyp „Kraków bez barier” (HackYeah 2026). Cel: WCAG 2.2 AA. Stan na 3.10.2026.",
    works: "Co działa",
    worksList: [
      "Cały główny scenariusz działa samą klawiaturą: wyszukanie, profil, karta miejsca i zgłoszenie. Fokus jest widoczny i wraca na miejsce po zamknięciu okna.",
      "Linki „Przejdź do treści” i „Przejdź do listy” pozwalają ominąć mapę.",
      "Wszystko z mapy jest też na liście miejsc — z tymi samymi wynikami i statusami.",
      "Statusy jako tekst, ikona i kształt, nie tylko kolor. Brak danych nigdy nie wygląda jak „spełnia”.",
      "Kontrast tekstu min. 4,5:1, cele dotykowe min. 48 px.",
      "Powiększenie 200% i ekran szerokości 320 px bez przewijania w poziomie.",
      "Liczba wyników po wyszukaniu i zmianie filtra jest ogłaszana czytnikom ekranu.",
      "Ograniczony ruch przy ustawieniu „zmniejsz ruch”.",
      "Automatyczne testy axe (WCAG 2.2 A/AA) każdego ekranu przed każdą zmianą w aplikacji.",
    ],
    limits: "Znane ograniczenia",
    limitsList: [
      "Nie testowaliśmy jeszcze ręcznie z czytnikami ekranu (VoiceOver, TalkBack, NVDA) ani z ich użytkownikami.",
      "Testy automatyczne wykrywają tylko część problemów — pełnego audytu WCAG 2.2 AA jeszcze nie było.",
      "Pinezki na mapie są ukryte przed czytnikami ekranu i nie da się do nich przejść klawiszem Tab — te same miejsca są na liście.",
      "Nie sprawdzaliśmy trybu wysokiego kontrastu systemu.",
      "Część danych jest przykładowa; oznaczamy ją „PRZYKŁAD”.",
      "Nazw miejsc i wartości z danych źródłowych nie tłumaczymy na angielski.",
    ],
    plan: "Plan usunięcia ograniczeń",
    planList: [
      "Przed pilotażem: ręczne testy głównego scenariusza z VoiceOver, TalkBack i NVDA oraz audyt WCAG 2.2 AA.",
      "W pilotażu: testy z osobami na wózkach i rodzicami z wózkami dziecięcymi.",
      "Po pilotażu: tryb wysokiego kontrastu.",
    ],
    contact: "Uwagi o dostępności zgłoś zespołowi projektu — poprawimy je przed pilotażem.",
  },
} as const;
