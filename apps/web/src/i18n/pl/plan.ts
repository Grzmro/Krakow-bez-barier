function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

export const plan = {
  pageTitle: "Plan dnia",
  lead: "Dodaj od 2 do 5 miejsc z ich kart i ułóż kolejność. Każdy odcinek liczymy osobno, z Twoim profilem. Plan zostaje w tej przeglądarce.",
  add: "Dodaj do planu",
  addedShort: "W planie",
  added: (name: string) => `Dodano do planu dnia: ${name}`,
  full: (max: number) => `Plan ma już ${max} miejsc. Usuń jedno, żeby dodać kolejne.`,
  openPlan: "Zobacz plan dnia",
  empty: "Plan jest pusty. Otwórz kartę miejsca i wybierz „Dodaj do planu”.",
  needSecond: "Dodaj jeszcze jedno miejsce, żeby zobaczyć trasę.",
  findPlaces: "Szukaj miejsc",
  stopsHeading: "Miejsca w planie",
  legsHeading: "Odcinki trasy",
  stopLabel: (n: number, name: string) => `${n}. ${name}`,
  moveUp: (name: string) => `Przesuń wyżej: ${name}`,
  moveDown: (name: string) => `Przesuń niżej: ${name}`,
  remove: (name: string) => `Usuń z planu: ${name}`,
  moved: (name: string, position: number, total: number) => `${name}: pozycja ${position} z ${total}`,
  removed: (name: string) => `Usunięto z planu: ${name}`,
  clear: "Wyczyść plan",
  cleared: "Plan wyczyszczony",
  loadingPlace: "Wczytujemy kartę miejsca…",
  placeMissing: "Nie znaleźliśmy tego miejsca. Możesz je usunąć z planu.",
  verdict: {
    noProfile: "Wybierz profil, żeby ocenić to miejsce.",
    profile: "Ocena dla Twojego profilu",
  },
  leg: (from: string, to: string) => `${from} → ${to}`,
  legLoading: "Wyznaczamy odcinek…",
  legNoRoute: "Nie znaleźliśmy trasy dla tego odcinka.",
  legUnavailable: "Wyznaczanie tras jest chwilowo niedostępne.",
  notConfigured: "Ten serwer nie ma klucza openrouteservice, więc nie wyznaczymy odcinków trasy. Plan miejsc działa, ale nie pokażemy czasu ani barier na drodze.",
  legBarriers: (list: string) => `Bariery na odcinku: ${list}`,
  legNoKnown: "Brak znanych barier na odcinku",
  legFallback: "Brak odcinka spełniającego Twoje potrzeby, to najlepsza dostępna alternatywa.",
  summary: {
    heading: "Podsumowanie",
    total: (minutes: number, distance: string) => `Łącznie: ${minutes} min, ${distance}`,
    partial: (minutes: number, distance: string) => `Policzone odcinki: ${minutes} min, ${distance}. Reszty nie znamy, to nie jest czas całego planu.`,
    none: "Nie policzyliśmy jeszcze żadnego odcinka.",
    counts: (barrier: number, conflict: number, unknown: number, met: number) =>
      [
        barrier ? `${barrier} ${plural(barrier, "odcinek z barierą", "odcinki z barierami", "odcinków z barierami")}` : null,
        conflict ? `${conflict} ${plural(conflict, "odcinek ze sprzecznymi danymi", "odcinki ze sprzecznymi danymi", "odcinków ze sprzecznymi danymi")}` : null,
        unknown ? `${unknown} ${plural(unknown, "odcinek z brakiem danych", "odcinki z brakiem danych", "odcinków z brakiem danych")}` : null,
        met ? `${met} ${plural(met, "odcinek bez znanych barier", "odcinki bez znanych barier", "odcinków bez znanych barier")}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    loading: (n: number) => `Liczymy jeszcze ${n} ${plural(n, "odcinek", "odcinki", "odcinków")}.`,
    failed: (n: number) => `${n} ${plural(n, "odcinka", "odcinków", "odcinków")} bez trasy.`,
  },
  unknownNote: "Brak danych nie oznacza, że odcinek jest dostępny.",
  route: "Trasa do tego miejsca",
} as const;
