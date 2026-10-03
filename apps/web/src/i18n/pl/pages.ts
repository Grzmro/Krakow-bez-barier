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
    // Notes the sources API writes itself (not from the source's own data).
    statusNote: {
      simulatedOutage: "Symulowana awaria źródła (przełącznik testowy). Pokazujemy ostatnie znane dane jako nieaktualne.",
      overdue: "Źródło nie odświeżało się o czasie. Dane mogą być nieaktualne.",
    },
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
        "Profil i progi zapisujemy tylko w Twojej przeglądarce. Język zapisujemy w ciasteczku kbb-lang (tylko „pl” albo „en”); przeglądarka wysyła je do serwera, żeby pokazać stronę w tym języku. Wszystko usuniesz, czyszcząc dane strony.",
      ],
      ["Trackery", "Nie używamy reklam, analityki śledzącej ani pikseli zewnętrznych."],
    ] as [string, string][],
  },
  a11y: {
    title: "Deklaracja dostępności",
    lead: "Prototyp „Kraków bez barier” (HackYeah 2026) ma spełniać WCAG 2.2 na poziomie AA. Główny scenariusz sprawdziliśmy automatycznie i samą klawiaturą, ale nie przeprowadziliśmy jeszcze pełnego audytu ani testów z czytnikami ekranu.",
    updatedLabel: "Ostatnia aktualizacja",
    updated: "3 października 2026",
    updatedIso: "2026-10-03",
    tocTitle: "Spis treści",
    statusLabel: {
      done: "Zrobione",
      inProgress: "W toku",
      planned: "Planowane",
      notPlanned: "Poza zakresem",
    },
    conformity: {
      id: "zgodnosc",
      title: "Stan zgodności",
      targetLabel: "Cel",
      target: "WCAG 2.2, poziom AA",
      stateLabel: "Stan dziś",
      state: "Zgodność częściowa — nie potwierdzona audytem",
      body: "Ekrany głównego scenariusza (strona główna, karta miejsca, strony informacyjne) przechodzą automatyczne testy axe (reguły WCAG 2.2 A i AA) bez naruszeń, na danych przykładowych. Takie testy wykrywają tylko część problemów, więc nie twierdzimy, że aplikacja jest w pełni zgodna. Poniżej opisujemy, co działa, co jest ograniczone i czego jeszcze nie sprawdziliśmy.",
    },
    works: {
      id: "dziala",
      title: "Co działa",
      intro: "Każdy punkt ma sprawdzający go test automatyczny, chyba że napisano inaczej.",
      items: [
        [
          "Klawiatura",
          "Cały główny scenariusz działa samą klawiaturą: wyszukanie miejsca, profil, karta miejsca i zgłoszenie. Po zamknięciu okna fokus wraca na przycisk, który je otworzył.",
        ],
        [
          "Czytnik ekranu — struktura",
          "Strony informacyjne mają jeden nagłówek główny i nagłówki w logicznej kolejności, a linki „Przejdź do treści” i „Przejdź do listy” pozwalają ominąć mapę. Liczba wyników po wyszukaniu i zmianie filtra jest ogłaszana. To sprawdzenia automatyczne — z czytnikami nie testowaliśmy (patrz niżej).",
        ],
        [
          "Kontrast",
          "Główne pary kolorów w palecie mają test kontrastu (tekst co najmniej 4,5:1, elementy interfejsu co najmniej 3:1), a axe sprawdza kontrast na ekranach głównego scenariusza.",
        ],
        [
          "Mapa jako tekst",
          "Każde miejsce z mapy jest też na liście, z tym samym werdyktem i statusem — test sprawdza, że żadnej pinezki nie brakuje na liście, dla przykładowych miejsc z włączonym profilem. Mapę można też przybliżać przyciskami.",
        ],
        [
          "Powiększenie i wąski ekran",
          "Główne ekrany mieszczą się bez przewijania w poziomie w oknie 640 px (jak 200% na ekranie 1280 px) i 320 px (jak 400%). To emulacja szerokości okna, nie powiększenie w przeglądarce.",
        ],
        [
          "Status nie tylko kolorem",
          "Werdykty i statusy mają tekst, ikonę i kształt. Brak danych jest neutralny i nigdy nie wygląda jak „Spełnia”.",
        ],
        [
          "Ograniczony ruch",
          "Przy ustawieniu systemowym „zmniejsz ruch” animacje i przejścia interfejsu są skrócone. Nie dotyczy to płynnego przesuwania mapy. Tego ustawienia nie sprawdzamy testem.",
        ],
      ],
    },
    limits: {
      id: "ograniczenia",
      title: "Znane ograniczenia i plan poprawy",
      intro: "Status mówi, na jakim etapie jest poprawa. Nie podajemy terminów, których nie możemy dotrzymać.",
      items: [
        [
          "inProgress",
          "Gesty mapy na telefonie",
          "Przesuwanie i powiększanie mapy gestami bywa niestabilne. Zamiast gestów działają przyciski przybliżania i oddalania oraz lista miejsc. Poprawiamy to.",
        ],
        [
          "planned",
          "Pinezki na mapie",
          "Pinezki są ukryte przed czytnikami ekranu i nie da się do nich dojść klawiszem Tab — te same miejsca są na liście. Planujemy połączyć mapę z listą i ocenić dostępność pinezek w audycie.",
        ],
        [
          "planned",
          "Kontrola na komputerze",
          "Testy dostępności uruchamiamy głównie w widoku telefonu; na komputerze sprawdzamy tylko wybrane ekrany. Planujemy rozszerzyć testy na cały główny scenariusz i skontrolować jego nagranie.",
        ],
        [
          "planned",
          "Testy z czytnikami i użytkownikami",
          "Planujemy ręczne testy głównego scenariusza z VoiceOver, TalkBack i NVDA oraz pełny audyt WCAG 2.2 AA, a przy pilotażu testy z osobami na wózkach i rodzicami z wózkami dziecięcymi.",
        ],
        [
          "planned",
          "Tryb wysokiego kontrastu",
          "Nie sprawdzaliśmy trybu wysokiego kontrastu systemu. Planujemy to po testach z czytnikami.",
        ],
        [
          "planned",
          "Kanał zgłoszeń dostępności",
          "Nie mamy jeszcze osobnego adresu do zgłaszania barier w samej aplikacji. Planujemy go opublikować.",
        ],
        [
          "notPlanned",
          "Dane przykładowe i tłumaczenie danych",
          "Część danych to przykład i jest oznaczona „PRZYKŁAD”. Nazw miejsc i wartości z danych źródłowych nie tłumaczymy na angielski.",
        ],
      ],
    },
    unverified: {
      id: "niesprawdzone",
      title: "Czego nie sprawdziliśmy",
      badge: "Niesprawdzone",
      intro: "Tych rzeczy nikt jeszcze nie zweryfikował, więc nie twierdzimy, że działają.",
      items: [
        "Ręczny przebieg z czytnikami ekranu: VoiceOver (iOS i macOS), TalkBack i NVDA.",
        "Przeglądarki inne niż Chromium (Firefox, Safari). Testy automatyczne uruchamiamy tylko w Chromium.",
        "Natywna aplikacja na iOS lub Androida — nie istnieje; sprawdzamy tylko stronę w przeglądarce.",
        "Powiększenie 200% i 400% w przeglądarce na komputerze. Sprawdzamy tylko wąskie okno.",
        "Tryb wysokiego kontrastu systemu.",
        "Testy z użytkownikami z niepełnosprawnościami i pełny audyt WCAG 2.2 AA.",
      ],
    },
    report: {
      id: "zglaszanie",
      title: "Zgłoś barierę",
      body: [
        "Jeśli aplikacja jest dla Ciebie niedostępna, napisz do zespołu projektu — osobiście podczas HackYeah 2026 albo kanałem, z którego pochodzi link do strony. Opisz, co chciałeś zrobić, na jakim urządzeniu i z jakim czytnikiem lub ustawieniem.",
        "Osobnego adresu do takich zgłoszeń jeszcze nie ma (patrz plan powyżej).",
        "Błąd w danych o miejscu zgłosisz w karcie miejsca, przez „To się nie zgadza” albo „Uzupełnij dane”. Zgłoszenia nie mają e-maila ani adresu IP.",
      ],
    },
    appeal: {
      id: "odwolanie",
      title: "Procedura odwoławcza",
      body: [
        "Prototyp nie jest jeszcze serwisem podmiotu publicznego. Gdyby wdrożył go podmiot publiczny, np. miasto, obowiązywałaby go ustawa z 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych.",
        "Według tej ustawy możesz zażądać zapewnienia dostępności albo alternatywnego sposobu dostępu. Jeśli odpowiedź Cię nie zadowoli lub jej nie dostaniesz, możesz złożyć skargę do Rzecznika Praw Obywatelskich. To informacja o przepisach, nie deklaracja zgodności z nimi.",
      ],
    },
  },
} as const;
