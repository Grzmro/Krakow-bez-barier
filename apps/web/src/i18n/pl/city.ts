import type { components } from "@krakow-bez-barier/contracts";

type PriorityFactor = components["schemas"]["PriorityFactor"];
type PriorityAction = components["schemas"]["PriorityAction"];
type NeedVerdict = components["schemas"]["NeedVerdict"];

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

const points = (n: number) => `${n} pkt`;
const places = (n: number) => `${n} ${plural(n, "miejsce", "miejsca", "miejsc")}`;

// Every entry takes (points, max per place, busy categories) so the panel renders them alike.
const criterion: Record<PriorityFactor, (p: number, max: number | null, categories: string) => string> = {
  barrier: (p: number) => `+${points(p)} za każdą potrzebę ze znaną barierą (np. stopnie przy wejściu, brak windy, brak toalety dostosowanej)`,
  open_report: (p: number, max: number | null) =>
    `+${points(p)} za każde zgłoszenie czekające na decyzję${max ? ` (liczą się maks. ${max})` : ""}`,
  conflict: (p: number) => `+${points(p)} za każdy atrybut, w którym źródła są sprzeczne`,
  busy_category: (p: number, _max: number | null, categories: string) =>
    `+${points(p)} gdy to miejsce, które odwiedza wiele osób (${categories}) — tylko razem z innym powodem`,
  missing_entrance_data: (p: number) => `+${points(p)} gdy nic nie wiemy o wejściu`,
  stale_data: (p: number) => `+${points(p)} gdy o jakimś atrybucie mamy tylko nieaktualne dane (starsze niż 12 mies. lub źródło nie odświeża się)`,
};

const reason: Record<PriorityFactor, (count: number, needs: string) => string> = {
  barrier: (_count: number, needs: string) => `bariera: ${needs}`,
  open_report: (count: number) => `${count} ${plural(count, "zgłoszenie", "zgłoszenia", "zgłoszeń")} do decyzji`,
  conflict: (count: number) => (count > 1 ? `sprzeczne źródła w ${count} atrybutach` : "sprzeczne źródła"),
  busy_category: () => "miejsce o dużym ruchu",
  missing_entrance_data: () => "brak danych o wejściu",
  stale_data: () => "nieaktualne dane",
};

// City panel (/miasto): aggregated statistics and repair priorities for the city's staff.
export const city = {
  title: "Panel dla miasta",
  signInLead: "Panel dla miasta używa tego samego logowania co panel moderatora.",
  signedIn: "Zalogowano. Statystyki miasta są poniżej.",
  loading: "Liczę statystyki…",
  loaded: (total: number) => `Statystyki gotowe: ${places(total)} w bazie.`,
  loadFailed: "Nie udało się wczytać statystyk.",
  loadLockedOut: (minutes: number) => `Za dużo nieudanych prób. Statystyki będą dostępne za ${minutes} min.`,
  intro: "Liczby z bazy Kraków bez barier: dane z OpenStreetMap i otwartych danych miasta oraz zgłoszenia mieszkańców.",
  introRules: "Tylko dane zbiorcze, bez danych osobowych. Brak danych nigdy nie liczy się jako „dostępne”.",
  scope: (excluded: string) =>
    `Liczymy wszystkie miejsca oprócz kategorii ukrytych domyślnie na mapie (${excluded}) — potrzeby z profilu „Wózek” ich nie dotyczą.`,
  introSample: "Tryb przykładowy: statystyki policzone z przykładowych miejsc, nie z danych Krakowa.",
  realOnly: "Miejsca i fakty oznaczone PRZYKŁAD są pominięte.",
  generatedAt: (date: string) => `Stan na ${date}`,
  tiles: {
    heading: "W skrócie",
    places: "Miejsca w bazie",
    withData: "Z danymi o dostępności",
    withoutData: "Bez żadnych danych",
    openReports: "Zgłoszenia do decyzji",
    stale: "Miejsca z nieaktualnymi danymi (>12 mies. lub źródło nie odświeża się)",
    staleFacts: (n: number) => `${n} ${plural(n, "fakt", "fakty", "faktów")}`,
    conflicts: "Miejsca ze sprzecznymi źródłami",
    conflictAttributes: (n: number) => `${n} ${plural(n, "atrybut", "atrybuty", "atrybutów")}`,
    share: (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}% miejsc` : "—"),
  },
  gus: {
    heading: "Kraków w statystyce GUS",
    lead: "Kogo dotyczą bariery: dane publiczne GUS dla całego miasta, bez podziału na dzielnice.",
    label: {
      disabled: "Osoby z niepełnosprawnością",
      postWorkingAge: "Osoby w wieku poprodukcyjnym",
      population: "Mieszkańcy",
      museumsAdapted: "Muzea przystosowane do potrzeb osób z niepełnosprawnością",
      museumVisitors: "Zwiedzający muzea w ciągu roku",
    },
    outOf: (part: string, total: string) => `${part} z ${total}`,
    year: (year: number, variableId: number) => `${year} · zmienna BDL ${variableId}`,
    census: (year: number, variableId: number) => `Narodowy Spis Powszechny ${year} · zmienna BDL ${variableId}`,
    museumsYear: (year: number, adaptedId: number, totalId: number) => `${year} · zmienne BDL ${adaptedId} i ${totalId}`,
    museumsNote: "GUS nie mówi, co „przystosowane” znaczy w konkretnym muzeum — to pokazuje karta miejsca.",
    sourcePrefix: "Źródło:",
    licenseFetched: (license: string, date: string) => `, licencja ${license}. Pobrano ${date}.`,
  },
  needs: {
    heading: "Bariery i luki w danych według potrzeby",
    lead: "Każde miejsce sprawdzone jak w profilu „Wózek” (wejście, drzwi min. 90 cm, winda, toaleta dostosowana) oraz pod kątem równej nawierzchni.",
    caption: "Liczba miejsc według wyniku dla każdej potrzeby",
    need: "Potrzeba",
    chartLabel: (need: string, barrier: number, total: number) => `${need}: ${barrier} z ${total} z barierą`,
    state: {
      met: "Spełnia",
      barrier: "Bariera",
      conflict: "Sprzeczne",
      unknown: "Brak danych",
    } satisfies Record<NeedVerdict, string>,
  },
  reports: {
    heading: "Zgłoszenia mieszkańców",
    caption: "Liczba zgłoszeń według statusu",
    status: "Status",
    count: "Liczba",
  },
  priorities: {
    heading: "Priorytety napraw i uzupełnień",
    lead: "Ranking miejsc, którymi warto zająć się najpierw. Wynik to suma punktów za każdy powód:",
    criterion,
    noVisits:
      "Nie mamy danych o liczbie odwiedzin, dlatego ruch przybliża kategoria miejsca. Wagi są jawne i łatwe do zmiany.",
    caption: (shown: number, total: number) => `Pierwsze ${shown} z ${places(total)} z co najmniej jednym powodem`,
    rank: "Nr",
    place: "Miejsce",
    category: "Kategoria",
    score: "Punkty",
    action: "Działanie",
    reasons: "Powody",
    actionName: {
      fix: "Naprawa",
      verify: "Uzupełnienie danych",
    } satisfies Record<PriorityAction, string>,
    reason,
    reasonWithPoints: (reason: string, p: number) => `${reason} (+${p})`,
    empty: "Żadne miejsce nie ma barier, luk w danych ani zgłoszeń.",
    regionLabel: "Tabela priorytetów (przewijana poziomo)",
    exportCsv: "Pobierz CSV",
    exported: (shown: number, total: number) =>
      shown < total ? `Pobrano plik CSV: pierwsze ${shown} z ${places(total)} rankingu.` : `Pobrano plik CSV: cały ranking, ${places(total)}.`,
    exportFailed: "Nie udało się pobrać rankingu do pliku CSV.",
    csvFile: (date: string, shown: number) => `priorytety-dostepnosci-krakow-top-${shown}-${date}.csv`,
    csvHeader: ["Nr", "Miejsce", "Kategoria", "Punkty", "Działanie", "Powody", "Zgłoszenia do decyzji", "Długość", "Szerokość", "Identyfikator"],
  },
} as const;
