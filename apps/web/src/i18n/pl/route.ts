import type { Profile } from "@krakow-bez-barier/contracts";

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

const profileName = { wheelchair: "wózek", stroller: "wózek dziecięcy", senior: "senior" } satisfies Record<Profile, string>;

const km = (meters: number) => `${(meters / 1000).toFixed(1).replace(".", ",")} km`;

// Route screen (`/trasa`, E7) and the segment notes the routes API writes.
export const route = {
  pageTitle: "Trasa",
  places: {
    dworzec: "Dworzec Główny",
    rynek: "Rynek Główny",
  },
  from: "Start",
  to: "Cel",
  swap: "Zamień start i cel",
  start: {
    placeholder: "Wpisz nazwę miejsca",
    options: "Skąd zacząć",
    me: "Moja lokalizacja",
    meHint: "Pozycję wysyłamy tylko do wyznaczenia trasy, w linku zaokrągloną do ok. 100 m",
    point: "Punkt z linku",
    empty: "Nie mamy miejsca o tej nazwie.",
    locating: "Ustalam Twoją pozycję…",
    located: "Trasa zaczyna się w Twojej pozycji.",
    failed: (message: string, start: string) => `${message} Trasa zaczyna się dalej: ${start}.`,
    help: "Jak to włączyć?",
    dismiss: "Zamknij komunikat",
    notFound: "Nie znaleźliśmy miejsca startu z linku, więc trasa zaczyna się na Dworcu Głównym.",
  },
  kind: "Rodzaj trasy",
  avoidStairs: "Unikaj schodów",
  shortest: "Najkrótsza",
  minutes: (n: number) => `${n} min`,
  distance: km,
  headingAria: (minutes: number, meters: number) => `Trasa: ${minutes} ${plural(minutes, "minuta", "minuty", "minut")}, ${km(meters)}`,
  profileOn: (p: Profile) =>
    `Ocena według progów profilu: ${profileName[p]} (nachylenie, nawierzchnia; krawężniki tam, gdzie mamy o nich dane).`,
  profileOff: "Bez profilu sprawdzamy schody i nawierzchnię. Włącz profil, by ocenić krawężniki i nachylenie.",
  loading: "Wyznaczamy trasę…",
  noKnown: "Trasa nie zawiera znanych barier",
  noKnownGaps: (m: number) => `Brak znanych barier, ale ${m < 1000 ? `${Math.round(m)} m` : km(m)} bez danych`,
  partlyUnknown: "Częściowo nie wiemy",
  unknownOn: (n: number, m: number) =>
    `brak danych na ${n} ${plural(n, "odcinku", "odcinkach", "odcinkach")}${n ? ` (${Math.round(m)} m)` : ""}`,
  conflictOn: (n: number) => `sprzeczne dane na ${n} ${plural(n, "odcinku", "odcinkach", "odcinkach")}`,
  hasBarriers: (list: string) => `Na trasie: ${list}`,
  noneOk: "Brak trasy spełniającej Twoje potrzeby",
  noneOkNoProfile: "Brak trasy bez schodów",
  alternative: "Najlepsza alternatywa — bariery:",
  alternativeUnmet: "Najlepsza alternatywa — bez znanych barier, ale nie spełnia:",
  limitsProfile: (kerbCm: number, smooth: boolean) =>
    `krawężnik do ${String(kerbCm).replace(".", ",")} cm, dopuszczalne nachylenie${smooth ? ", gładka nawierzchnia" : ""}`,
  limitsNoProfile: "bez schodów",
  segments: "Odcinki trasy",
  segmentsHint: "Odcinki w skali długości. Szczegóły w „Krok po kroku”.",
  steps: "Krok po kroku",
  stepsAria: "Odcinki trasy, tekstowa wersja mapy",
  segmentAria: (i: number, n: number, instruction: string, m: number, status: string, note: string) =>
    `Odcinek ${i} z ${n}. ${instruction}, ${Math.round(m)} ${plural(Math.round(m), "metr", "metry", "metrów")}. ${status}${note ? `: ${note}` : ""}.`,
  meters: (m: number) => `${Math.round(m)} m`,
  nobody: "Nikt jeszcze nie sprawdził tego odcinka.",
  sourceLine: (name: string, date: string) => `${name} · ${date}`,
  destination: {
    title: "Cel: wejście",
    hint: "Fakty z karty miejsca.",
    open: "Otwórz kartę miejsca",
  },
  attribution: "Trasa",
  go: "Ruszamy",
  nav: {
    title: "Prowadzenie",
    stepOf: (i: number, n: number) => `Krok ${i} z ${n}`,
    left: (m: number) => `jeszcze ${Math.round(m)} m`,
    thenIn: (instruction: string, m: number) => `${instruction} za ${Math.round(m)} m`,
    destinationIn: (m: number) => `Cel za ${Math.round(m)} m`,
    remaining: (m: number, minutes: number) => `Do celu: ${m < 1000 ? `${Math.round(m)} m` : km(m)} · ${minutes} min`,
    here: "Na tym odcinku",
    ahead: (m: number) => `Za ${Math.round(m)} m`,
    unchecked: "nikt jeszcze nie sprawdził tego odcinka",
    tracking: "Prowadzimy według Twojej pozycji. Pozycja zostaje na tym urządzeniu.",
    locating: "Szukamy Twojej pozycji… Kroki możesz też przełączać przyciskami.",
    manualDenied: "Brak zgody na lokalizację. Przełączaj kroki przyciskami „Poprzedni krok” i „Następny krok”.",
    manualUnavailable: "Nie znamy Twojej pozycji. Przełączaj kroki przyciskami „Poprzedni krok” i „Następny krok”.",
    follow: "Mapa podąża za mną",
    offRoute: (m: number) => `Zboczyłeś z trasy (ok. ${Math.round(m)} m)`,
    reroute: "Wyznacz od nowa",
    rerouteHint: "Nowa trasa poprowadzi od miejsca, w którym jesteś. Pozycję wysyłamy do serwisu wyznaczania tras (openrouteservice) tylko w tym celu; my jej nie zapisujemy.",
    arrived: "Jesteś u celu",
    previous: "Poprzedni krok",
    next: "Następny krok",
    end: "Zakończ",
    yourPosition: "Twoja pozycja",
    current: "aktualny krok",
  },
  error: {
    unavailable: "Wyznaczanie tras jest chwilowo niedostępne. Miejsca na liście działają.",
    noRoute: "Nie znaleźliśmy trasy między tymi punktami.",
    noPlace: "Nie znaleźliśmy miejsca docelowego. Link może być nieaktualny.",
    notConfigured: "Tryb demonstracyjny: bez klucza openrouteservice działa tylko przykładowa trasa Dworzec Główny → Rynek Główny, z domyślnymi progami profilu.",
    showExample: "Pokaż przykładową trasę",
    retry: "Spróbuj ponownie",
  },
  back: "Wstecz",
  map: {
    label: "Mapa trasy. Ta sama trasa jest opisana w liście „Krok po kroku”.",
    unavailable: "Mapa jest niedostępna w tej przeglądarce. Cała trasa jest w liście „Krok po kroku”.",
    you: "Ty",
  },
  // Segment notes written by the routes API (server side).
  note: {
    stairs: "schody",
    kerb: (cm: number) => `krawężnik ${String(cm).replace(".", ",")} cm`,
    incline: (pct: number) => `nachylenie do ${pct}%`,
    inclineLow: "płasko (do 1%)",
    rough: (surface: string) => `nawierzchnia: ${surface}`,
    conflict: (attributes: string) => `sprzeczne dane: ${attributes}`,
    noSurface: "brak danych o nawierzchni",
    partSurface: "brak danych o nawierzchni na części odcinka",
    noStairs: "brak danych o schodach",
    noIncline: "brak danych o nachyleniu",
    noKerb: "brak danych o krawężnikach",
    separator: ", ",
  },
} as const;
