import type { LocateFailure } from "@/lib/native/geolocation";

// "W mojej okolicy" — the device position action (native prompt in the app, browser API on the web).
export const nearby = {
  action: "W mojej okolicy",
  actionSub: "Ustal moją pozycję",
  locating: "Ustalam pozycję…",
  found: (latitude: string, longitude: string, accuracy: number) =>
    `Jesteś tutaj: ${latitude}° N, ${longitude}° E (dokładność ±${accuracy} m)`,
  privacy: "Pozycja zostaje na Twoim urządzeniu — nie wysyłamy jej na serwer.",
  errors: {
    denied: "Brak zgody na lokalizację. Możesz ją włączyć w ustawieniach urządzenia.",
    unavailable: "Nie udało się ustalić pozycji. Sprawdź, czy usługi lokalizacji są włączone, i spróbuj ponownie.",
    unsupported: "To urządzenie nie udostępnia lokalizacji.",
  } satisfies Record<LocateFailure, string>,
  home: {
    sortOff: "Pokaż miejsca od najbliższych",
    sortOn: "Od najbliższych, odległość od Ciebie",
    privacy:
      "Dokładna pozycja zostaje na urządzeniu. Do wyszukiwania wysyłamy tylko przybliżony obszar w promieniu ok. 2 km, nie Twoją pozycję.",
    announce: "W Twojej okolicy, od najbliższych",
    you: "Ty",
    emptyHint: "Szukasz tylko w Twojej okolicy (w promieniu ok. 2 km).",
    nearestOnly: (shown: number, total: number) =>
      `Pokazano ${shown} najbliższych z ${total} miejsc w okolicy. Zawęź wyszukiwanie nazwą, kategorią lub filtrem, żeby zobaczyć pozostałe.`,
  },
  devPage: {
    title: "Funkcje natywne",
    lead: "Diagnostyka aplikacji mobilnej: na której platformie działa strona i czy lokalizacja działa. Pozycja jest ustalana od razu po wejściu.",
    platform: "Platforma",
    platforms: { ios: "aplikacja iOS", android: "aplikacja Android", web: "przeglądarka" },
  },
} as const;
