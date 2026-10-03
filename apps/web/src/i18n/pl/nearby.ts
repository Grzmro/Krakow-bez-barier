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
  devPage: {
    title: "Funkcje natywne",
    lead: "Diagnostyka aplikacji mobilnej: na której platformie działa strona i czy lokalizacja działa. Pozycja jest ustalana od razu po wejściu.",
    platform: "Platforma",
    platforms: { ios: "aplikacja iOS", android: "aplikacja Android", web: "przeglądarka" },
  },
} as const;
