import type { Need, Profile } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

const places = (n: number) => `${n} ${plural(n, "miejsce", "miejsca", "miejsc")}`;

const needName = {
  entrance: "Wejście",
  door: "Drzwi",
  lift: "Winda",
  toilet: "Toaleta dostosowana",
  surface: "Nawierzchnia",
  changing_table: "Przewijak",
} satisfies Record<Need, string>;

const counts = (byStatus: Record<Status, number>) =>
  `${byStatus.met} spełnia, ${byStatus.barrier} nie spełnia, ${byStatus.unknown} brak danych, ${byStatus.conflict} sprzeczne`;

const profileName = { wheelchair: "Wózek", stroller: "Wózek dziecięcy" } satisfies Record<Profile, string>;

// Needs profiles (E2). Every label names a barrier or facility — never a disability (R4).
export const profile = {
  page: {
    title: "Profil potrzeb",
    lead: "Włącz profil, a przy każdym miejscu zobaczysz, czy pasuje do Twoich progów — i dlaczego.",
  },
  switch: {
    label: "Profil potrzeb",
    off: "Dla każdego",
    offAria: "Profil wyłączony, widok dla każdego",
    short: { wheelchair: "Wózek", stroller: "Dziecięcy" } satisfies Record<Profile, string>,
  },
  name: profileName,
  settings: "Progi profilu",
  needName,
  thresholds: {
    title: "Progi profilu",
    proposal: "Wartości domyślne to propozycja. Zmień je pod siebie.",
    maxThresholdCm: "Maks. próg",
    minDoorWidthCm: "Min. szerokość wejścia",
    requireStepFree: "Bez stopni",
    requireStepFreeHint: "Gdy wyłączone, 1 stopień jest dopuszczalny",
    requireLift: "Winda przy piętrach",
    requireAccessibleToilet: "Toaleta dostosowana",
    requireSmoothSurface: "Równa nawierzchnia",
    requireChangingTable: "Przewijak",
    cm: "cm",
    decrease: (label: string) => `Zmniejsz: ${label}`,
    increase: (label: string) => `Zwiększ: ${label}`,
    browserOnly: "Ustawienia zostają tylko w tej przeglądarce.",
    reset: "Przywróć domyślne",
    done: "Gotowe",
  },
  hideFailing: "Ukryj niespełniające",
  counter: (n: number, status: string) => `${n} ${status}`,
  countersLabel: "Liczba miejsc według wyniku",
  announce: (active: Profile | null, shown: number, hidden: number, byStatus: Record<Status, number>) =>
    active
      ? `Profil: ${profileName[active].toLowerCase()}. ${places(shown)}${hidden ? ` (ukryto niespełniające: ${hidden})` : ""}: ${counts(byStatus)}.`
      : `Profil wyłączony. Widok dla każdego, ${places(shown)}.`,
  reasons: {
    steps: (n: number) => `${n} ${plural(n, "stopień", "stopnie", "stopni")}`,
    threshold: (cm: number) => `próg ${cm} cm`,
    door: (cm: number) => `drzwi ${cm} cm`,
    surface: "nierówna nawierzchnia",
    missing: (need: Need) => `${needName[need].toLowerCase()}: brak`,
    unresolved: (need: Need) => needName[need].toLowerCase(),
    conflictElsewhere: "sprzeczne dane o miejscu",
  },
  groups: {
    barrier: "Blokuje",
    met: "Pasuje",
    unknown: "Nie wiadomo",
  },
  list: {
    heading: "Miejsca",
    search: "Szukaj miejsca",
    searchHint: "Nazwa lub ulica",
    results: places,
    loading: "Wczytywanie miejsc…",
    error: "Nie udało się wczytać miejsc.",
    empty: "Brak miejsc dla tego wyszukiwania.",
    details: "Dlaczego?",
    hideDetails: "Ukryj szczegóły",
    noProfile: "Włącz profil, aby zobaczyć, co Cię blokuje.",
  },
} as const;
