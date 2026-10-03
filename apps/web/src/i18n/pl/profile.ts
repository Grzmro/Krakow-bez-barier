import type { Need, OutageEquipment, Profile } from "@krakow-bez-barier/contracts";
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
  bench: "Ławka",
} satisfies Record<Need, string>;

const counts = (byStatus: Record<Status, number>) =>
  `${byStatus.met} spełnia, ${byStatus.barrier} nie spełnia, ${byStatus.unknown} brak danych, ${byStatus.conflict} sprzeczne`;

const profileName = { wheelchair: "Wózek", stroller: "Wózek dziecięcy", senior: "Senior" } satisfies Record<Profile, string>;

// Needs profiles (E2). Labels never name a disability or health condition (R4); „Senior” names an age group, as US-2.8 does.
export const profile = {
  switch: {
    label: "Profil potrzeb",
    off: "Dla każdego",
    offAria: "Profil wyłączony, widok dla każdego",
    short: { wheelchair: "Wózek", stroller: "Dziecięcy", senior: "Senior" } satisfies Record<Profile, string>,
  },
  name: profileName,
  settings: "Progi profilu",
  needName,
  thresholds: {
    title: "Progi profilu",
    proposal: "Wartości domyślne możesz zmienić.",
    maxThresholdCm: "Maks. próg",
    minDoorWidthCm: "Min. szerokość wejścia",
    requireStepFree: "Bez stopni",
    requireStepFreeHint: "Gdy wyłączone, 1 stopień jest dopuszczalny",
    requireLift: "Winda przy piętrach",
    requireAccessibleToilet: "Toaleta dostosowana",
    requireSmoothSurface: "Równa nawierzchnia",
    requireChangingTable: "Przewijak",
    requireBench: "Ławka lub miejsce odpoczynku",
    cm: "cm",
    decrease: (label: string) => `Zmniejsz: ${label}`,
    increase: (label: string) => `Zwiększ: ${label}`,
    browserOnly: "Ustawienia zostają tylko w tej przeglądarce.",
    reset: "Przywróć domyślne",
    done: "Gotowe",
  },
  hideFailing: "Ukryj niespełniające",
  counter: (n: number, status: string) => `${n} ${status.toLowerCase()}`,
  countersLabel: "Pokaż tylko miejsca z wynikiem",
  announce: (active: Profile, shown: number, total: number, byStatus: Record<Status, number>) =>
    `Profil: ${profileName[active].toLowerCase()}. ${shown === total ? places(total) : `Pokazano ${shown} z ${places(total)}`}: ${counts(byStatus)}.`,
  reasons: {
    steps: (n: number) => `${n} ${plural(n, "stopień", "stopnie", "stopni")}`,
    threshold: (cm: number) => `próg ${cm} cm`,
    door: (cm: number) => `drzwi ${cm} cm`,
    surface: "nierówna nawierzchnia",
    overallNo: "Oznaczone jako niedostępne dla wózków",
    overallOnly: (value: "yes" | "limited"): string =>
      value === "yes" ? "wejście: ogólnie oznaczone jako dostępne, bez szczegółów" : "wejście: ogólnie oznaczone jako częściowo dostępne, bez szczegółów",
    missing: (need: Need) => `${needName[need].toLowerCase()}: brak`,
    liftWithoutFloors: "winda: brak, piętra: brak danych",
    liftFloorsConflict: "winda: brak, piętra: sprzeczne dane",
    unresolved: (need: Need) => needName[need].toLowerCase(),
    conflictElsewhere: "sprzeczne dane o miejscu",
    outage: (equipment: OutageEquipment): string => (equipment === "lift" ? "zgłoszona awaria windy" : "zgłoszona awaria podjazdu"),
  },
  groups: {
    barrier: "Blokuje",
    met: "Pasuje",
    unknown: "Nie wiadomo",
  },
  list: {
    details: "Dlaczego?",
    detailsAria: (place: string) => `Dlaczego? ${place}`,
    hideDetails: "Ukryj szczegóły",
    hideDetailsAria: (place: string) => `Ukryj szczegóły: ${place}`,
    showAll: "Pokaż wszystkie wyniki",
    filteredEmpty: "Żadne miejsce nie pasuje do wybranego wyniku",
    filteredEmptyHint: "Wyniki ukrywa filtr wyniku profilu.",
    noneMet: {
      title: "Żadne miejsce na liście nie ma jeszcze kompletu danych dla tego profilu",
      missing: (missing: { need: Need; count: number }[], total: number) =>
        `Najczęściej brakuje danych o: ${missing.map(({ need, count }) => `${needName[need].toLowerCase()} (${count} z ${total})`).join(", ")}.`,
      hint: "Otwarte dane rzadko opisują stopnie, progi i szerokość drzwi. „Brak danych” nie znaczy „niedostępne” — szczegóły pod „Dlaczego?” przy miejscu.",
    },
  },
} as const;
